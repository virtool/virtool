"""Backfill logic for copying Mongo samples into Postgres.

This module holds the idempotent copy used by the sample backfill revision. It is
kept here rather than inline in the revision so it can be unit tested and reused.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import compose_legacy_id_single_expression
from virtool.jobs.pg import SQLJob
from virtool.migration import MigrationContext
from virtool.pg.base import Base
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
)
from virtool.users.pg import SQLUser

logger = get_logger("migration")


async def copy_samples_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``samples`` document into Postgres.

    One row is written per Mongo document into ``legacy_samples``, plus one row per
    label and per subtraction into the ``legacy_sample_labels`` and
    ``legacy_sample_subtractions`` join tables. Documents are processed one at a
    time and committed individually, so memory stays bounded and a failure
    part-way through keeps the rows already written rather than rolling back the
    whole collection.

    The document ``_id`` values are snapshotted up front so the rest of the run
    fetches one document at a time by id, rather than holding a single Mongo cursor
    open for the entire migration.

    The parent row and its join rows are inserted in a single transaction and
    committed together, so a committed sample always carries its complete set of
    join rows. Documents already present in Postgres (by ``legacy_id``) are
    therefore skipped wholesale, and every insert uses ``ON CONFLICT DO NOTHING``
    as a second line of defence, so the backfill is safe to re-run after an
    interruption.

    Foreign keys are copied directly rather than resolved from legacy string ids.
    Earlier revisions already normalized the referenced fields in Mongo:
    ``bfzcj3gxn2dd`` converted ``group`` to an integer id or ``None``,
    ``rev_24ysb9cwjiv1`` converted the ``subtractions`` array to integer ids, and
    ``rev_ie7r3vdaf5mu`` converted ``user.id`` to an integer. ``labels`` were
    always integer ids. Only ``user`` and ``job`` are resolved here, and only to
    tolerate the legacy string ids that predate those conversions:

    - ``user`` is required. A sample that references a user missing from Postgres
      raises, rather than being backfilled with a null owner.
    - ``job`` is optional and was historically deletable, so a dangling job
      reference is backfilled as ``NULL`` and logged with a warning.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLLegacySample.legacy_id).where(
                SQLLegacySample.legacy_id.isnot(None),
            ),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing samples in postgres",
            count=len(existing_legacy_ids),
        )

        sample_ids = [
            document["_id"]
            async for document in ctx.mongo.samples.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        user_id_cache: dict[int | str, int | None] = {}
        job_id_cache: dict[int | str, int | None] = {}

        for sample_id in sample_ids:
            if sample_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.samples.find_one({"_id": sample_id})

            if document is None:
                skipped_count += 1
                continue

            user_id = await _resolve_user_id(session, document, user_id_cache)
            job_id = await _resolve_job_id(session, document, job_id_cache)

            sample_pk = (
                await session.execute(
                    insert(SQLLegacySample)
                    .values(**_build_values(document, user_id, job_id))
                    .on_conflict_do_nothing(index_elements=["legacy_id"])
                    .returning(SQLLegacySample.id),
                )
            ).scalar_one_or_none()

            if sample_pk is None:
                sample_pk = (
                    await session.execute(
                        select(SQLLegacySample.id).where(
                            SQLLegacySample.legacy_id == sample_id,
                        ),
                    )
                ).scalar_one()

            await _insert_join_rows(session, sample_pk, document)
            await session.commit()

            migrated_count += 1

        logger.info(
            "sample migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )


def _build_values(
    document: dict,
    user_id: int,
    job_id: int | None,
) -> dict:
    """Map a Mongo sample document to a ``SQLLegacySample`` values dict.

    The integer ``id`` is omitted so the database assigns the identity surrogate
    key. ``group`` is copied directly because it is already an integer id or
    ``None`` after the ``bfzcj3gxn2dd`` backfill; ``user_id`` and ``job_id`` are
    the resolved Postgres integer foreign keys. The Mongo ``workflows``, ``nuvs``,
    ``pathoscope``, ``results``, ``space``, and ``uploads`` fields are dropped,
    matching the columns the dual-write persists.
    """
    group = document.get("group")

    return {
        "legacy_id": document["_id"],
        "name": document["name"],
        "host": document.get("host") or "",
        "isolate": document.get("isolate") or "",
        "locale": document.get("locale") or "",
        "notes": document.get("notes") or "",
        "library_type": document["library_type"],
        "format": document.get("format") or "fastq",
        "group_id": group if isinstance(group, int) else None,
        "quality": document.get("quality"),
        "created_at": document["created_at"],
        "paired": document.get("paired", False),
        "ready": document.get("ready", False),
        "hold": document.get("hold", True),
        "is_legacy": document.get("is_legacy", False),
        "all_read": document.get("all_read", False),
        "all_write": document.get("all_write", False),
        "group_read": document.get("group_read", False),
        "group_write": document.get("group_write", False),
        "user_id": user_id,
        "job_id": job_id,
    }


async def _insert_join_rows(
    session: AsyncSession,
    sample_pk: int,
    document: dict,
) -> None:
    """Insert the label and subtraction join rows for a sample.

    Both ``labels`` and ``subtractions`` already hold integer ``labels.id`` and
    ``subtractions.id`` values, so they map directly with no legacy-id resolution.
    Each insert uses ``ON CONFLICT DO NOTHING`` so a re-run over an interrupted
    document adds only the rows that are missing.
    """
    for label_id in document.get("labels") or []:
        await session.execute(
            insert(SQLLegacySampleLabel)
            .values(sample_id=sample_pk, label_id=label_id)
            .on_conflict_do_nothing(),
        )

    for subtraction_id in document.get("subtractions") or []:
        await session.execute(
            insert(SQLLegacySampleSubtraction)
            .values(sample_id=sample_pk, subtraction_id=subtraction_id)
            .on_conflict_do_nothing(),
        )


async def _resolve_id(
    session: AsyncSession,
    model: type[Base],
    reference: int | str,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a Mongo reference to a Postgres primary key, memoising results.

    The reference may be a legacy string id or a modern integer id. The resolved
    id (or ``None`` if no row matches) is cached by reference so that samples
    sharing the same user do not each issue a query.
    """
    if reference in cache:
        return cache[reference]

    resolved = (
        await session.execute(
            select(model.id).where(
                compose_legacy_id_single_expression(model, reference),
            ),
        )
    ).scalar_one_or_none()

    cache[reference] = resolved

    return resolved


async def _resolve_user_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int:
    """Resolve a document's ``user`` reference to a Postgres ``users.id``.

    A sample always has an owner, so a missing ``user`` reference or one that no
    longer resolves to a Postgres row raises rather than being backfilled as
    ``NULL``.
    """
    user = document.get("user")

    if not user or "id" not in user:
        msg = f"sample {document['_id']!r} has no user reference"
        raise ValueError(msg)

    reference = user["id"]

    user_id = await _resolve_id(session, SQLUser, reference, cache)

    if user_id is None:
        msg = (
            f"sample {document['_id']!r} references user {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    return user_id


async def _resolve_job_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a document's ``job`` reference to a Postgres ``jobs.id``.

    Returns ``None`` when the document has no job, and also when a job is
    referenced but no longer exists in Postgres. Dangling references are logged so
    the migration leaves an audit trail, distinct from the silent legitimate
    no-job case.
    """
    job = document.get("job")

    if not job or "id" not in job:
        return None

    reference = job["id"]

    job_id = await _resolve_id(session, SQLJob, reference, cache)

    if job_id is None:
        logger.warning(
            "sample references a job that no longer exists; backfilling null job_id",
            sample_id=document["_id"],
            job=reference,
        )

    return job_id
