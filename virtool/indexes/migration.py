"""Migration logic for the Mongo-to-Postgres index move.

This module holds the idempotent copy used by the index backfill revision. Keeping
it here rather than in the revision file keeps the logic unit-testable and reusable.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import resolve_legacy_id
from virtool.indexes.sql import SQLIndex
from virtool.jobs.pg import SQLJob
from virtool.migration import MigrationContext
from virtool.pg.base import HasLegacyAndModernIDs
from virtool.references.sql import SQLReference
from virtool.types import Document
from virtool.users.pg import SQLUser

logger = get_logger("migration")


async def copy_indexes_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``indexes`` document into the ``indexes`` table.

    One row is written per Mongo document. The embedded ``reference``, ``user``,
    ``job`` and ``task`` objects are flattened onto the ``reference_id``,
    ``user_id``, ``job_id`` and ``task_id`` columns exactly as the dual-write path
    does, and ``legacy_id`` and ``storage_key`` both hold the Mongo ``_id``.

    The document ``_id`` values are snapshotted up front with a projection-only
    query so the rest of the run fetches one document at a time by id, rather than
    holding a single Mongo cursor open for the entire migration. Documents already
    present in Postgres (by ``legacy_id``) are skipped, and every insert uses
    ``ON CONFLICT (legacy_id) DO NOTHING`` as a second line of defence, so the
    backfill is safe to re-run after an interruption. Each document is committed
    individually, so memory stays bounded and a failure part-way through keeps the
    rows already written rather than rolling back the whole collection.

    An index is backed by exactly one build: a legacy build carries a ``job`` and a
    build created since the task migration carries a ``task``. The
    ``ck_indexes_job_or_task`` check constraint enforces that exactly one of
    ``job_id`` and ``task_id`` is set, so a document that somehow carries both or
    neither is rejected loudly by the database rather than silently coerced.

    Three integrity failures are loud rather than silent, matching the required
    relationships they represent:

    - An index whose embedded ``reference.id`` does not resolve to a
      ``legacy_references`` row raises. Every index belongs to a reference, and
      references are already migrated.
    - An index whose embedded ``user.id`` does not resolve to a ``users`` row
      raises. Every index is attributed to a user, and users are already migrated.
    - A job-backed index whose ``job.id`` does not resolve to a ``jobs`` row raises.
      The production audit found no such index, so an unresolvable job is a
      data-integrity problem, not a nullable relationship -- and the check
      constraint would reject the ``NULL`` job on a task-less document regardless.

    The embedded ``task.id`` is a native Postgres ``tasks`` primary key, so it is
    used directly; an id with no ``tasks`` row is rejected by the foreign key.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_legacy_ids = {
            row[0]
            for row in await session.execute(select(SQLIndex.legacy_id))
            if row[0] is not None
        }

        logger.info(
            "found existing indexes in postgres", count=len(existing_legacy_ids)
        )

        index_ids = [
            document["_id"]
            async for document in ctx.mongo.indexes.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        reference_id_cache: dict[int | str, int] = {}
        user_id_cache: dict[int | str, int] = {}
        job_id_cache: dict[int | str, int] = {}

        for index_id in index_ids:
            if index_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.indexes.find_one({"_id": index_id})

            if document is None:
                skipped_count += 1
                continue

            values = await _index_row_values(
                session,
                document,
                reference_id_cache,
                user_id_cache,
                job_id_cache,
            )

            await session.execute(
                insert(SQLIndex)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["legacy_id"]),
            )
            await session.commit()

            migrated_count += 1

    logger.info(
        "index migration complete",
        migrated=migrated_count,
        skipped=skipped_count,
    )


async def _index_row_values(
    session: AsyncSession,
    document: Document,
    reference_id_cache: dict[int | str, int],
    user_id_cache: dict[int | str, int],
    job_id_cache: dict[int | str, int],
) -> dict:
    """Flatten a Mongo index document into ``indexes`` row values.

    The embedded ``reference``, ``user`` and (for legacy builds) ``job`` ids are
    resolved to their Postgres primary keys, raising when a required reference does
    not resolve. The ``task`` id is a native Postgres id and is used directly.
    """
    index_id = document["_id"]

    reference_id = await _resolve_required_id(
        session,
        SQLReference,
        document["reference"]["id"],
        reference_id_cache,
        index_id,
        "reference",
    )

    user_id = await _resolve_required_id(
        session,
        SQLUser,
        document["user"]["id"],
        user_id_cache,
        index_id,
        "user",
    )

    job = document["job"]
    task = document["task"]

    job_id = None

    if job is not None:
        job_id = await _resolve_required_id(
            session,
            SQLJob,
            job["id"],
            job_id_cache,
            index_id,
            "job",
        )

    return {
        "legacy_id": index_id,
        "version": document["version"],
        "created_at": document["created_at"],
        "manifest": document["manifest"],
        "ready": document["ready"],
        "storage_key": index_id,
        "reference_id": reference_id,
        "user_id": user_id,
        "job_id": job_id,
        "task_id": task["id"] if task is not None else None,
    }


async def _resolve_required_id(
    session: AsyncSession,
    model: HasLegacyAndModernIDs,
    id_: int | str,
    cache: dict[int | str, int],
    index_id: str,
    relationship: str,
) -> int:
    """Resolve an embedded legacy or modern id to a Postgres primary key.

    Hits are memoised because indexes cluster heavily by reference and job. Misses
    are not cached and raise: the relationship is required, and the referenced
    resource is already migrated, so an unresolvable id is a data-integrity problem.
    """
    if id_ in cache:
        return cache[id_]

    resolved = await resolve_legacy_id(session, model, id_)

    if resolved is None:
        msg = (
            f"index {index_id!r} references {relationship} {id_!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    cache[id_] = resolved

    return resolved
