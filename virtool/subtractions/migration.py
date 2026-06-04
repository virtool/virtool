"""Shared backfill logic for copying Mongo subtractions into Postgres.

This module holds the idempotent copy used by both the original subtraction
backfill revision and the later re-backfill revision. Keeping it here lets both
revisions share a single implementation instead of duplicating ~300 lines.
"""

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import compose_legacy_id_single_expression
from virtool.jobs.pg import SQLJob
from virtool.migration import MigrationContext
from virtool.pg.base import Base
from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile
from virtool.uploads.sql import SQLUpload
from virtool.users.pg import SQLUser

logger = get_logger("migration")


async def copy_subtractions_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``subtraction`` document into Postgres.

    One row is written per Mongo document into the ``subtractions`` table,
    including soft-deleted documents, so the Postgres row count matches the Mongo
    document count exactly. Documents are processed one at a time and committed
    individually, so memory stays bounded and a failure part-way through keeps the
    rows already written rather than rolling back the whole collection.

    The document ``_id`` values are snapshotted up front so the rest of the run
    fetches one document at a time by id, rather than holding a single Mongo
    cursor open for the entire migration.

    Documents already present in Postgres (by ``legacy_id``) are skipped, and the
    insert uses ``ON CONFLICT (legacy_id) DO NOTHING`` as a second line of
    defence, so the backfill is safe to re-run after an interruption.

    Unlike the analyses backfill, this never fails on a dangling reference.
    ``user``, ``job``, and ``upload`` references that no longer resolve to a
    Postgres row are backfilled as ``NULL`` and logged with a warning. These
    collections used to be deletable, so legacy subtractions can reference rows
    that have since been removed, and ``NULL`` is the truthful mapping.

    Finally, ``subtraction_files.subtraction_id`` is backfilled with a single
    set-based ``UPDATE`` join on ``legacy_id``. The collection name is
    ``subtraction`` (singular); the plural ``subtractions`` collection does not
    exist.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLSubtraction.legacy_id).where(
                SQLSubtraction.legacy_id.isnot(None),
            ),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing subtractions in postgres",
            count=len(existing_legacy_ids),
        )

        subtraction_ids = [
            document["_id"]
            async for document in ctx.mongo.subtraction.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        user_id_cache: dict[int | str, int | None] = {}
        job_id_cache: dict[int | str, int | None] = {}
        upload_id_cache: dict[int | str, int | None] = {}

        for subtraction_id in subtraction_ids:
            if subtraction_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.subtraction.find_one({"_id": subtraction_id})

            if document is None:
                skipped_count += 1
                continue

            user_id = await _resolve_user_id(session, document, user_id_cache)
            job_id = await _resolve_job_id(session, document, job_id_cache)
            upload_id = await _resolve_upload_id(session, document, upload_id_cache)

            await session.execute(
                insert(SQLSubtraction)
                .values(**_build_values(document, user_id, job_id, upload_id))
                .on_conflict_do_nothing(index_elements=["legacy_id"]),
            )
            await session.commit()

            migrated_count += 1

        logger.info(
            "subtraction migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )

        await _backfill_file_subtraction_ids(session)


def _build_values(
    document: dict,
    user_id: int | None,
    job_id: int | None,
    upload_id: int | None,
) -> dict:
    """Map a Mongo subtraction document to a ``SQLSubtraction`` values dict.

    The integer ``id`` is omitted so the database assigns the identity surrogate
    key. The ``space`` field is intentionally dropped. ``user_id``, ``job_id``,
    and ``upload_id`` are the resolved Postgres integer foreign keys, not the raw
    Mongo references.
    """
    return {
        "legacy_id": document["_id"],
        "name": document["name"],
        "nickname": document.get("nickname") or "",
        "count": document.get("count"),
        "gc": document.get("gc"),
        "created_at": document["created_at"],
        "deleted": document.get("deleted", False),
        "ready": document.get("ready", False),
        "user_id": user_id,
        "job_id": job_id,
        "upload_id": upload_id,
    }


async def _resolve_id(
    session: AsyncSession,
    model: type[Base],
    reference: int | str,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a Mongo reference to a Postgres primary key, memoising results.

    The reference may be a legacy string id or a modern integer id. The resolved
    id (or ``None`` if no row matches) is cached by reference so that subtractions
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
) -> int | None:
    """Resolve a document's ``user`` reference to a Postgres ``users.id``.

    Returns ``None`` and logs a warning when the referenced user no longer exists,
    rather than failing the migration.
    """
    user = document.get("user")

    if user is None:
        return None

    reference = user["id"]

    user_id = await _resolve_id(session, SQLUser, reference, cache)

    if user_id is None:
        logger.warning(
            "subtraction references a user that no longer exists; "
            "backfilling null user_id",
            subtraction_id=document["_id"],
            user=reference,
        )

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

    if job is None:
        return None

    reference = job["id"]

    job_id = await _resolve_id(session, SQLJob, reference, cache)

    if job_id is None:
        logger.warning(
            "subtraction references a job that no longer exists; "
            "backfilling null job_id",
            subtraction_id=document["_id"],
            job=reference,
        )

    return job_id


async def _resolve_upload_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a document's ``upload`` reference to a Postgres ``uploads.id``.

    The ``upload`` field holds the integer upload id directly. Returns ``None``
    when the document has no upload, and also when the upload no longer exists in
    Postgres, logging a warning in the latter case. Uploads used to be deletable,
    so legacy subtractions can reference an upload that has since been removed.
    """
    reference = document.get("upload")

    if reference is None:
        return None

    upload_id = await _resolve_id(session, SQLUpload, reference, cache)

    if upload_id is None:
        logger.warning(
            "subtraction references an upload that no longer exists; "
            "backfilling null upload_id",
            subtraction_id=document["_id"],
            upload=reference,
        )

    return upload_id


async def _backfill_file_subtraction_ids(session: AsyncSession) -> None:
    """Populate ``subtraction_files.subtraction_id`` from ``legacy_id``.

    The legacy ``subtraction`` column holds the Mongo subtraction string id, which
    matches ``subtractions.legacy_id``. This is a single set-based join, guarded by
    ``subtraction_id IS NULL`` so re-runs only touch rows not already linked.
    """
    result = await session.execute(
        update(SQLSubtractionFile)
        .where(
            SQLSubtractionFile.subtraction_id.is_(None),
            SQLSubtractionFile.subtraction == SQLSubtraction.legacy_id,
        )
        .values(subtraction_id=SQLSubtraction.id),
    )
    await session.commit()

    logger.info("backfilled subtraction_files.subtraction_id", linked=result.rowcount)
