"""Shared migration logic for the Mongo-to-Postgres OTU and sequence move.

This module holds the idempotent copy used by the OTU/sequence backfill revision
and the drift check that gates the read cutover. Keeping them here keeps the
logic unit-testable and reusable.

Unlike the standard migration playbook, ``legacy_otus`` and ``legacy_sequences``
have no ``legacy_id`` column: their primary key ``id`` is the Mongo ``_id``
string itself. Idempotency and skip-existing therefore key on ``id`` rather than
``legacy_id``.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.api.custom_json import dump_string, loads
from virtool.data.topg import resolve_legacy_id
from virtool.migration import MigrationContext
from virtool.otus.db import lock_legacy_otu, otu_row_values, sequence_row_values
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

    Every OTU belongs to a reference and references are already migrated, so a
    reference that no longer resolves raises rather than being backfilled as
    ``NULL``.
    """
    reference = document["reference"]["id"]

    reference_id = await _lookup_reference_id(session, reference, cache)

    if reference_id is None:
        msg = (
            f"otu {document['_id']!r} references reference {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    return reference_id


async def _lookup_reference_id(
    session: AsyncSession,
    reference: int | str,
    cache: dict[int | str, int],
) -> int | None:
    """Look up an embedded ``reference.id`` in Postgres, memoising hits.

    The reference may be a legacy string id or a modern integer id;
    :func:`resolve_legacy_id` tolerates both. Hits are memoised because OTUs
    cluster heavily by reference. Misses are not cached: the application keeps
    writing while a migration runs, so a reference that does not resolve now may
    resolve on a later call.
    """
    if reference in cache:
        return cache[reference]

    reference_id = await resolve_legacy_id(session, SQLReference, reference)

    if reference_id is not None:
        cache[reference] = reference_id

    return reference_id


_OTU_CHUNK_SIZE = 500
"""How many OTUs to hold in memory at once while comparing the two stores."""

_SEQUENCE_CHUNK_SIZE = 200
"""How many sequences to hold in memory at once while comparing the two stores.

Smaller than the OTU chunk because a sequence document carries its nucleotide
string. Both constants exist to bound memory; cutting them costs run time and
nothing else.
"""


async def compare_otu_and_sequence_stores(ctx: MigrationContext) -> None:
    """Verify the Mongo and Postgres OTU and sequence stores agree.

    A gating drift check run after the OTU/sequence backfill and before OTU and
    sequence reads switch to Postgres. It changes nothing: it reads every
    production OTU and sequence (no sampling) and raises if the two stores
    disagree.

    A Postgres row is compared against the row the write path would produce from
    the current Mongo document, by rebuilding it with the very functions the
    dual-write and backfill use -- :func:`otu_row_values` and
    :func:`sequence_row_values`. Everything they normalise is therefore normalised
    identically here and cannot be mistaken for drift:

    - A Mongo ``abbreviation`` of ``None`` or a missing key becomes ``""``.
    - A missing ``segment`` key becomes SQL ``NULL``.
    - An embedded ``reference.id`` in either form -- the legacy string id or the
      integer id written since references were migrated -- resolves to the same
      integer ``legacy_references`` primary key.

    The ``data`` JSONB is compared against the Mongo document rendered through the
    engine's JSON serializer, because that -- not the document itself -- is what the
    column holds. See :func:`_as_stored_json`.

    The check runs in two passes. The first walks both stores in chunks and
    collects *candidate* ids: present in one store but not the other, or holding a
    row that does not match its document. The second re-reads each candidate from
    both stores individually and only reports the ones that still disagree. The
    application keeps writing while a migration runs, so a document written or
    deleted between the two chunk reads would otherwise be reported as drift; the
    second pass costs nothing on a clean run, where there are no candidates.

    Each pass runs in its own :class:`AsyncSession`. The scanning session's
    identity map still holds every row it loaded, and a ``select()`` against it
    would hand those instances back rather than re-reading the row -- which would
    leave the second pass unable to see the very dual-write it exists to
    tolerate.

    The check is exhaustive before it fails: drift is accumulated across every OTU
    and sequence, the full per-document diff is logged, and a single
    :class:`ValueError` is raised at the end. A clean run logs zero drift with the
    document counts.
    """
    otu_drift = await _compare_otus(ctx)
    sequence_drift = await _compare_sequences(ctx)

    if otu_drift or sequence_drift:
        for report in otu_drift:
            logger.error("otu drift", **report)

        for report in sequence_drift:
            logger.error("sequence drift", **report)

        msg = (
            f"store drift detected in {len(otu_drift)} otus and "
            f"{len(sequence_drift)} sequences"
        )
        raise ValueError(msg)

    logger.info("otu and sequence stores match; no drift")


async def _compare_otus(ctx: MigrationContext) -> list[dict]:
    """Compare the Mongo ``otus`` collection against ``legacy_otus``.

    The scan and the verification of its candidates run in separate sessions so
    the verification really re-reads each row. See
    :func:`compare_otu_and_sequence_stores`.
    """
    mongo_ids = {
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    }

    reference_id_cache: dict[int | str, int] = {}

    async with AsyncSession(ctx.pg) as session:
        postgres_ids = {row[0] for row in await session.execute(select(SQLOTU.id))}

        candidates = mongo_ids ^ postgres_ids
        shared = sorted(mongo_ids & postgres_ids)

        for start in range(0, len(shared), _OTU_CHUNK_SIZE):
            chunk = shared[start : start + _OTU_CHUNK_SIZE]

            documents = {
                document["_id"]: document
                async for document in ctx.mongo.otus.find({"_id": {"$in": chunk}})
            }

            rows = {
                row.id: row
                for row in (
                    await session.execute(select(SQLOTU).where(SQLOTU.id.in_(chunk)))
                ).scalars()
            }

            for otu_id in chunk:
                document = documents.get(otu_id)
                row = rows.get(otu_id)

                if document is None or row is None:
                    candidates.add(otu_id)
                    continue

                reference_id = await _lookup_reference_id(
                    session,
                    document["reference"]["id"],
                    reference_id_cache,
                )

                if reference_id is None or _diff_row(
                    row,
                    otu_row_values(document, reference_id),
                ):
                    candidates.add(otu_id)

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for otu_id in sorted(candidates)
            if (report := await _verify_otu(ctx, session, otu_id, reference_id_cache))
        ]

    logger.info("compared otus", otus=len(mongo_ids), drifted=len(drifted))

    return drifted


async def _compare_sequences(ctx: MigrationContext) -> list[dict]:
    """Compare the Mongo ``sequences`` collection against ``legacy_sequences``.

    A sequence whose parent OTU has no ``legacy_otus`` row cannot have a
    ``legacy_sequences`` row either -- the not-null foreign key would reject it --
    so such a sequence surfaces here as missing from Postgres.

    The scan and the verification of its candidates run in separate sessions so
    the verification really re-reads each row. See
    :func:`compare_otu_and_sequence_stores`.
    """
    mongo_ids = {
        document["_id"]
        async for document in ctx.mongo.sequences.find({}, projection=["_id"])
    }

    async with AsyncSession(ctx.pg) as session:
        postgres_ids = {row[0] for row in await session.execute(select(SQLSequence.id))}

        candidates = mongo_ids ^ postgres_ids
        shared = sorted(mongo_ids & postgres_ids)

        for start in range(0, len(shared), _SEQUENCE_CHUNK_SIZE):
            chunk = shared[start : start + _SEQUENCE_CHUNK_SIZE]

            documents = {
                document["_id"]: document
                async for document in ctx.mongo.sequences.find(
                    {"_id": {"$in": chunk}},
                )
            }

            rows = {
                row.id: row
                for row in (
                    await session.execute(
                        select(SQLSequence).where(SQLSequence.id.in_(chunk)),
                    )
                ).scalars()
            }

            for sequence_id in chunk:
                document = documents.get(sequence_id)
                row = rows.get(sequence_id)

                if (
                    document is None
                    or row is None
                    or _diff_row(row, sequence_row_values(document))
                ):
                    candidates.add(sequence_id)

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for sequence_id in sorted(candidates)
            if (report := await _verify_sequence(ctx, session, sequence_id))
        ]

    logger.info(
        "compared sequences",
        sequences=len(mongo_ids),
        drifted=len(drifted),
    )

    return drifted


async def _verify_otu(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
    cache: dict[int | str, int],
) -> dict | None:
    """Re-read one candidate OTU from both stores and report it if it still drifts.

    Returns ``None`` when the candidate turns out to agree after all, which happens
    when the application wrote or deleted the OTU between the chunked reads that
    flagged it.
    """
    document = await ctx.mongo.otus.find_one({"_id": otu_id})

    row = (
        await session.execute(select(SQLOTU).where(SQLOTU.id == otu_id))
    ).scalar_one_or_none()

    if document is None and row is None:
        return None

    if document is None:
        return {"otu_id": otu_id, "issue": "missing from mongo"}

    if row is None:
        return {"otu_id": otu_id, "issue": "missing from postgres"}

    reference = document["reference"]["id"]
    reference_id = await _lookup_reference_id(session, reference, cache)

    if reference_id is None:
        return {
            "otu_id": otu_id,
            "issue": "reference missing from postgres",
            "reference": reference,
        }

    differences = _diff_row(row, otu_row_values(document, reference_id))

    if differences:
        return {"otu_id": otu_id, "differences": differences}

    return None


async def _verify_sequence(
    ctx: MigrationContext,
    session: AsyncSession,
    sequence_id: str,
) -> dict | None:
    """Re-read one candidate sequence from both stores and report remaining drift.

    Returns ``None`` when the candidate turns out to agree after all. See
    :func:`_verify_otu`.
    """
    document = await ctx.mongo.sequences.find_one({"_id": sequence_id})

    row = (
        await session.execute(select(SQLSequence).where(SQLSequence.id == sequence_id))
    ).scalar_one_or_none()

    if document is None and row is None:
        return None

    if document is None:
        return {"sequence_id": sequence_id, "issue": "missing from mongo"}

    if row is None:
        return {"sequence_id": sequence_id, "issue": "missing from postgres"}

    differences = _diff_row(row, sequence_row_values(document))

    if differences:
        return {"sequence_id": sequence_id, "differences": differences}

    return None


def _as_stored_json(document: Document) -> Document:
    """Render a Mongo document as the ``data`` JSONB column stores and returns it.

    ``data`` holds the document verbatim, but a JSONB column can only hold what JSON
    can express. The engine's serializer writes a ``datetime`` as an ISO string and
    reading the column back yields that string, never a ``datetime`` again. Legacy
    OTU documents carry a ``created_at``, so comparing a row against the raw document
    would report every one of them as drifted.

    Passing the expected document through the very serializer the write path uses
    compares like with like. It cannot mask real drift: it applies exactly the
    transformation that the write path already applied to the row being checked, so
    any difference the write path would have preserved survives it too.
    """
    return loads(dump_string(document))


def _diff_row(
    row: SQLOTU | SQLSequence,
    expected: dict[str, Any],
) -> dict[str, dict]:
    """Diff a Postgres row against the column values the write path would produce.

    ``data`` is reduced to the top-level keys that differ rather than reported
    whole, so a report stays readable when one field of a large document drifted.
    """
    differences: dict[str, dict] = {}

    for column, value in expected.items():
        expected_value = _as_stored_json(value) if column == "data" else value
        actual_value = getattr(row, column)

        if actual_value == expected_value:
            continue

        if column == "data":
            differences["data"] = _diff_data(expected_value, actual_value)
        else:
            differences[column] = {"mongo": expected_value, "postgres": actual_value}

    return differences


def _diff_data(mongo_data: Document, postgres_data: Document) -> dict[str, dict]:
    """Diff the Mongo document against the ``data`` JSONB, key by top-level key."""
    return {
        key: {"mongo": mongo_data.get(key), "postgres": postgres_data.get(key)}
        for key in sorted(set(mongo_data) | set(postgres_data))
        if mongo_data.get(key) != postgres_data.get(key)
    }


async def backfill_sequence_positions(ctx: MigrationContext) -> None:
    """Assign every ``legacy_sequences`` row its position within its OTU.

    An OTU's sequences are read back with the same unsorted
    ``find({"otu_id": otu_id})`` that :func:`virtool.otus.db.join` uses, so the order
    Mongo returns them in is by definition the order every historical diff was
    computed against. Counting them off in that order records it.

    The backfill is authoritative rather than skip-existing. A sequence created
    between the dual-write shipping and this revision running computed its position
    as ``MAX + 1`` over an OTU with no Postgres rows yet and so wrongly took position
    zero, colliding with the OTU's true first sequence. Re-deriving every position
    from Mongo repairs that, and makes the revision idempotent: a second run reads
    the same order and writes the same numbers.

    Each OTU is locked with :func:`virtool.otus.db.lock_legacy_otu` *before* its
    sequences are read from Mongo, which is the same lock every dual-write path takes.
    Taking it first is what makes the renumber safe: a ``create_sequence`` landing
    between the read and the write would append a sequence this run cannot see, and
    that sequence would compute its own position as ``MAX + 1`` over an OTU whose rows
    are still unpositioned -- taking position zero, which this run then also assigns
    to the OTU's true first sequence. The lock is released by the commit at the end of
    each OTU, bounding both the transaction and memory.
    """
    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    positioned_count = 0

    async with AsyncSession(ctx.pg) as session:
        otu_ids_present = {row[0] for row in await session.execute(select(SQLOTU.id))}

        for otu_id in otu_ids:
            await lock_legacy_otu(session, otu_id)

            documents = [
                document
                async for document in ctx.mongo.sequences.find({"otu_id": otu_id})
            ]

            if documents:
                if otu_id not in otu_ids_present and not await _otu_exists(
                    session,
                    otu_id,
                ):
                    msg = (
                        f"otu {otu_id!r} has sequences in mongo but no row in postgres; "
                        f"run the otu and sequence backfill first"
                    )
                    raise ValueError(msg)

                for position, document in enumerate(documents):
                    await session.execute(
                        insert(SQLSequence)
                        .values(**sequence_row_values(document), position=position)
                        .on_conflict_do_update(
                            index_elements=["id"],
                            set_={"position": position},
                        ),
                    )

                positioned_count += len(documents)

            await session.commit()

    logger.info(
        "sequence position backfill complete",
        otus=len(otu_ids),
        sequences=positioned_count,
    )


async def compare_sequence_positions(ctx: MigrationContext) -> None:
    """Verify Postgres orders each OTU's sequences exactly as Mongo returns them.

    A gating check for the OTU read cutover, and the one thing
    :func:`compare_otu_and_sequence_stores` cannot do. That check compares a row
    against the columns :func:`sequence_row_values` derives from a single Mongo
    document, but ``position`` orders a sequence *within its OTU* and so is not
    derivable from one document. It has to be checked an OTU at a time.

    The check matters because a joined OTU rebuilt from Postgres feeds
    :func:`virtool.history.db.patch_to_version`, whose ``dictdiffer`` diffs address
    an isolate's sequences by list index. If Postgres hands them back in a different
    order than Mongo did, index builds, reference clones and analysis formatting all
    silently apply each stored change to the wrong sequence.

    A ``NULL`` position is drift. Postgres sorts nulls last on an ascending order,
    so an unbackfilled row would otherwise be quietly shuffled to the end of its OTU
    instead of failing the check.

    Like the other drift checks this is read-only and re-runnable, and re-verifies
    each candidate OTU individually before reporting it, so an OTU written between
    the two reads is not mistaken for drift.
    """
    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    async with AsyncSession(ctx.pg) as session:
        candidates = [
            otu_id
            for otu_id in otu_ids
            if await _compare_otu_sequence_order(ctx, session, otu_id)
        ]

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for otu_id in candidates
            if (report := await _compare_otu_sequence_order(ctx, session, otu_id))
        ]

    if drifted:
        for report in drifted:
            logger.error("sequence order drift", **report)

        msg = f"sequence order drift detected in {len(drifted)} otus"
        raise ValueError(msg)

    logger.info("sequence order matches mongo in every otu", otus=len(otu_ids))


async def _compare_otu_sequence_order(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
) -> dict | None:
    """Report an OTU whose Postgres sequence order does not match Mongo's."""
    mongo_ids = [
        document["_id"]
        async for document in ctx.mongo.sequences.find(
            {"otu_id": otu_id},
            projection=["_id"],
        )
    ]

    rows = (
        await session.execute(
            select(SQLSequence.id, SQLSequence.position)
            .where(SQLSequence.otu_id == otu_id)
            .order_by(SQLSequence.position),
        )
    ).all()

    if any(row.position is None for row in rows):
        return {
            "otu_id": otu_id,
            "issue": "sequences without a position",
            "sequence_ids": [row.id for row in rows if row.position is None],
        }

    postgres_ids = [row.id for row in rows]

    if mongo_ids != postgres_ids:
        return {
            "otu_id": otu_id,
            "issue": "sequence order differs",
            "mongo": mongo_ids,
            "postgres": postgres_ids,
        }

    return None
