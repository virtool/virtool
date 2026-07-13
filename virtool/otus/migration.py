"""Shared backfill logic for copying Mongo OTUs and sequences into Postgres.

This module holds the idempotent copy used by the OTU/sequence backfill
revision. Keeping it here keeps the logic unit-testable and reusable.

Unlike the standard migration playbook, ``legacy_otus`` and ``legacy_sequences``
have no ``legacy_id`` column: their primary key ``id`` is the Mongo ``_id``
string itself. Idempotency and skip-existing therefore key on ``id`` rather than
``legacy_id``.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import resolve_legacy_id
from virtool.migration import MigrationContext
from virtool.otus.db import otu_row_values, sequence_row_values
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.sql import SQLReference
from virtool.types import Document

logger = get_logger("migration")


async def copy_otus_and_sequences_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``otus`` and ``sequences`` document into Postgres.

    One row is written per Mongo document into ``legacy_otus`` and
    ``legacy_sequences``. The whole document is stored verbatim in the ``data``
    JSONB column and the remaining columns are promoted from it, exactly as the
    dual-write path does. Documents are processed one at a time and committed
    individually, so memory stays bounded and a failure part-way through keeps the
    rows already written rather than rolling back the whole collection.

    The document ``_id`` values are snapshotted up front with a projection-only
    query so the rest of the run fetches one document at a time by id, rather than
    holding a single Mongo cursor open for the entire migration.

    OTUs are backfilled before sequences because ``legacy_sequences.otu_id`` is a
    foreign key to ``legacy_otus.id``. Documents already present in Postgres (by
    ``id``) are skipped, and every insert uses ``ON CONFLICT (id) DO NOTHING`` as a
    second line of defence, so the backfill is safe to re-run after an
    interruption.

    Two integrity failures are loud rather than silent, matching the required
    relationships they represent:

    - An OTU whose embedded ``reference.id`` does not resolve to a
      ``legacy_references`` row raises. Every OTU belongs to a reference, and
      references are already migrated, so an unresolvable one is a data-integrity
      problem, not a nullable relationship.
    - A sequence whose ``otu_id`` matches no ``legacy_otus`` row raises. Such a
      sequence is an orphan that should have been removed upstream by
      :func:`virtool.references.migration.purge_orphaned_references`; the not-null
      foreign key would reject it regardless.
    """
    async with AsyncSession(ctx.pg) as session:
        await _copy_otus(ctx, session)
        await _copy_sequences(ctx, session)


async def _copy_otus(ctx: MigrationContext, session: AsyncSession) -> None:
    """Backfill the Mongo ``otus`` collection into ``legacy_otus``."""
    existing_otu_ids = {row[0] for row in await session.execute(select(SQLOTU.id))}

    logger.info("found existing otus in postgres", count=len(existing_otu_ids))

    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    migrated_count = 0
    skipped_count = 0
    reference_id_cache: dict[int | str, int] = {}

    for otu_id in otu_ids:
        if otu_id in existing_otu_ids:
            skipped_count += 1
            continue

        document = await ctx.mongo.otus.find_one({"_id": otu_id})

        if document is None:
            skipped_count += 1
            continue

        reference_id = await _resolve_reference_id(
            session,
            document,
            reference_id_cache,
        )

        await session.execute(
            insert(SQLOTU)
            .values(**otu_row_values(document, reference_id))
            .on_conflict_do_nothing(index_elements=["id"]),
        )
        await session.commit()

        migrated_count += 1

    logger.info(
        "otu migration complete",
        migrated=migrated_count,
        skipped=skipped_count,
    )


async def _copy_sequences(ctx: MigrationContext, session: AsyncSession) -> None:
    """Backfill the Mongo ``sequences`` collection into ``legacy_sequences``.

    Runs after :func:`_copy_otus` so every parent OTU already has a
    ``legacy_otus`` row. The full set of OTU ids is loaded up front so an orphan
    sequence can be caught with a clear error before the not-null foreign key
    rejects it with an opaque ``IntegrityError``. That set is only a cache: a miss
    is re-checked against Postgres before raising, because the dual-writing
    application may have created the parent OTU after the set was loaded.
    """
    otu_ids_present = {row[0] for row in await session.execute(select(SQLOTU.id))}
    existing_sequence_ids = {
        row[0] for row in await session.execute(select(SQLSequence.id))
    }

    logger.info(
        "found existing sequences in postgres",
        count=len(existing_sequence_ids),
    )

    sequence_ids = [
        document["_id"]
        async for document in ctx.mongo.sequences.find({}, projection=["_id"])
    ]

    migrated_count = 0
    skipped_count = 0

    for sequence_id in sequence_ids:
        if sequence_id in existing_sequence_ids:
            skipped_count += 1
            continue

        document = await ctx.mongo.sequences.find_one({"_id": sequence_id})

        if document is None:
            skipped_count += 1
            continue

        otu_id = document["otu_id"]

        if otu_id not in otu_ids_present:
            if not await _otu_exists(session, otu_id):
                msg = (
                    f"sequence {sequence_id!r} references otu "
                    f"{otu_id!r} which does not exist in postgres"
                )
                raise ValueError(msg)

            otu_ids_present.add(otu_id)

        await session.execute(
            insert(SQLSequence)
            .values(**sequence_row_values(document))
            .on_conflict_do_nothing(index_elements=["id"]),
        )
        await session.commit()

        migrated_count += 1

    logger.info(
        "sequence migration complete",
        migrated=migrated_count,
        skipped=skipped_count,
    )


async def _otu_exists(session: AsyncSession, otu_id: str) -> bool:
    """Check Postgres directly for a ``legacy_otus`` row.

    Used to confirm a sequence's parent really is missing before raising. The OTU
    may have been dual-written by the running application after the up-front id set
    was loaded, in which case the sequence is not an orphan and the backfill must
    not abort.
    """
    return (
        await session.execute(select(SQLOTU.id).where(SQLOTU.id == otu_id))
    ).scalar_one_or_none() is not None


async def _resolve_reference_id(
    session: AsyncSession,
    document: Document,
    cache: dict[int | str, int],
) -> int:
    """Resolve an OTU document's embedded ``reference.id`` to a Postgres id.

    The reference may be a legacy string id or a modern integer id;
    :func:`resolve_legacy_id` tolerates both. Every OTU belongs to a reference and
    references are already migrated, so a reference that no longer resolves raises
    rather than being backfilled as ``NULL``. Results are memoised because OTUs
    cluster heavily by reference.
    """
    reference = document["reference"]["id"]

    if reference in cache:
        return cache[reference]

    reference_id = await resolve_legacy_id(session, SQLReference, reference)

    if reference_id is None:
        msg = (
            f"otu {document['_id']!r} references reference {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    cache[reference] = reference_id

    return reference_id
