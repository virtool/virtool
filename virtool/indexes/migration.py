"""Migration logic for the Mongo-to-Postgres index move.

This module holds the idempotent copy used by the index backfill revision and the
drift check that gates the read cutover. Keeping them here rather than in the
revision files keeps the logic unit-testable and reusable.
"""

from dataclasses import dataclass, field
from datetime import datetime

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

    An index is backed by at most one build: a legacy build carries a ``job`` and a
    build created since the task migration carries a ``task``. The
    ``ck_indexes_job_or_task`` check constraint enforces that no more than one of
    ``job_id`` and ``task_id`` is set, so a document that somehow carries both is
    rejected loudly by the database rather than silently coerced.

    Two integrity failures are loud, matching the required relationships they
    represent:

    - An index whose embedded ``reference.id`` does not resolve to a
      ``legacy_references`` row raises. Every index belongs to a reference, and
      references are already migrated.
    - An index whose embedded ``user.id`` does not resolve to a ``users`` row
      raises. Every index is attributed to a user, and users are already migrated.

    A job-backed index whose ``job.id`` does not resolve to a ``jobs`` row is
    different: jobs are historically deletable, so an old completed build can
    outlive the job that produced it. Such an index is copied with a ``NULL``
    ``job_id`` and a warning, rather than aborting the backfill.

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

    The embedded ``reference`` and ``user`` ids are resolved to their Postgres
    primary keys, raising when a required reference does not resolve. A legacy
    build's ``job`` id is resolved too, but a job deleted before the jobs migration
    resolves to ``NULL`` with a warning rather than raising. The ``task`` id is a
    native Postgres id and is used directly.
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
        job_id = await _resolve_optional_job_id(
            session,
            job["id"],
            job_id_cache,
            index_id,
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

    Hits are memoised because indexes cluster heavily by reference. Misses are not
    cached and raise: the relationship is required, and the referenced resource is
    already migrated, so an unresolvable id is a data-integrity problem.
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


async def _resolve_optional_job_id(
    session: AsyncSession,
    id_: int | str,
    cache: dict[int | str, int],
    index_id: str,
) -> int | None:
    """Resolve a legacy build's ``job`` id to a Postgres primary key.

    Jobs are historically deletable, so an old completed build can reference a job
    that was removed before the jobs migration and therefore never landed in
    Postgres. Rather than aborting the backfill, an unresolvable job is logged and
    stored as ``NULL``. Hits are memoised because indexes cluster heavily by job.
    """
    if id_ in cache:
        return cache[id_]

    resolved = await resolve_legacy_id(session, SQLJob, id_)

    if resolved is None:
        logger.warning(
            "index references job missing from postgres; storing null job_id",
            index_id=index_id,
            job_id=id_,
        )

        return None

    cache[id_] = resolved

    return resolved


_INDEX_CHUNK_SIZE = 500
"""How many shared indexes to load from each store per round of the scan."""


@dataclass
class _ResolutionCaches:
    """Memoised resolutions of embedded legacy or modern ids to Postgres keys.

    Indexes cluster heavily by reference, user and (for legacy builds) job, so a
    hit is reused rather than re-queried. Held for the length of one comparison and
    shared between the scan and the re-verify pass, whose resolutions are identical.
    """

    reference: dict[int | str, int] = field(default_factory=dict)
    user: dict[int | str, int] = field(default_factory=dict)
    job: dict[int | str, int] = field(default_factory=dict)


async def compare_index_stores(ctx: MigrationContext) -> None:
    """Verify the Mongo and Postgres index stores agree.

    A gating drift check run after the index backfill and before index reads switch
    to Postgres. It changes nothing: it reads every production index (no sampling)
    and raises if the two stores disagree, so reads never move to a Postgres that has
    silently fallen behind Mongo.

    Every promoted field is compared, and each embedded id is normalised the way the
    dual-write and backfill normalise it, so nothing they store faithfully is
    mistaken for drift:

    - ``version``, ``ready`` and ``manifest`` are compared directly. The ``manifest``
      is compared as a whole map, not a key set: a single otu version rewritten under
      an existing key is the silent corruption this gate exists to catch, because a
      wrong manifest builds a wrong index months downstream.
    - ``storage_key`` must equal the Mongo ``_id``. A migrated row carries the legacy
      id in ``storage_key``, and it is load-bearing -- it addresses the index's files
      in object storage -- so a row pointing at the wrong key is drift even when every
      other field agrees.
    - ``created_at`` is compared at millisecond precision. ``virtool.utils.timestamp``
      is microsecond-precise, but BSON holds a datetime as int64 milliseconds and
      drops the microseconds on write, while the Postgres column keeps them. So the
      two stores hold the same instant to a different precision, and both sides are
      floored to the millisecond -- Mongo's precision -- before they are compared.
    - ``reference.id`` may be a legacy Mongo string id or the integer primary key
      written since references were migrated; both forms resolve to the same
      ``legacy_references`` id, which is what ``reference_id`` must equal.
    - ``user.id`` resolves the same way against ``users``.
    - ``task.id`` is a native Postgres ``tasks`` id and is compared directly. A
      document with no ``task`` -- a null value or, on a legacy build, no key at all
      -- must hold a ``NULL`` ``task_id``.
    - ``job.id`` resolves against ``jobs``, but a ``NULL`` ``job_id`` against a Mongo
      ``job`` that no longer resolves is expected, not drift: a job-backed index
      outlives the job that built it, and a deleted job leaves the row's optional
      foreign key null. A Mongo job that *does* resolve must match ``job_id``.

    The check runs in two passes, in two sessions. The first walks both stores and
    collects candidates: present in one store but not the other, or holding a row
    that does not match its document. The second re-reads each candidate from both
    stores once, in a fresh session so the row is really re-read rather than handed
    back from the first session's identity map, and reports only the ones that still
    disagree. The application keeps writing while a migration runs, so a document
    written or deleted between the two reads would otherwise be reported as drift; the
    second pass costs nothing on a clean run, where there are no candidates.

    The check is exhaustive before it fails: drift is accumulated across every index,
    the full per-document report is logged with ``logger.error``, and a single
    :class:`ValueError` is raised at the end. A clean run logs zero drift with the
    document count.
    """
    drift = await _compare_indexes(ctx)

    if not drift:
        logger.info("index stores match; no drift")
        return

    for report in drift:
        logger.error("index drift", **report)

    msg = f"store drift detected in {len(drift)} indexes"
    raise ValueError(msg)


async def _compare_indexes(ctx: MigrationContext) -> list[dict]:
    """Compare the Mongo ``indexes`` collection against the ``indexes`` table.

    Indexes are keyed across the stores by the Mongo ``_id``, which the table holds
    as ``legacy_id``. Native Postgres rows carry no ``legacy_id`` and have no Mongo
    counterpart, so they are excluded rather than reported as orphans.

    The scan and the verification of its candidates run in separate sessions so the
    verification really re-reads each row. See :func:`compare_index_stores`.
    """
    mongo_ids = {
        document["_id"]
        async for document in ctx.mongo.indexes.find({}, projection=["_id"])
    }

    caches = _ResolutionCaches()

    async with AsyncSession(ctx.pg) as session:
        postgres_ids = {
            row[0]
            for row in await session.execute(select(SQLIndex.legacy_id))
            if row[0] is not None
        }

        candidates = mongo_ids ^ postgres_ids
        shared = sorted(mongo_ids & postgres_ids)

        for start in range(0, len(shared), _INDEX_CHUNK_SIZE):
            chunk = shared[start : start + _INDEX_CHUNK_SIZE]

            documents = {
                document["_id"]: document
                async for document in ctx.mongo.indexes.find({"_id": {"$in": chunk}})
            }

            rows = {
                row.legacy_id: row
                for row in (
                    await session.execute(
                        select(SQLIndex).where(SQLIndex.legacy_id.in_(chunk)),
                    )
                ).scalars()
            }

            for index_id in chunk:
                document = documents.get(index_id)
                row = rows.get(index_id)

                if document is None or row is None:
                    candidates.add(index_id)
                    continue

                if await _diff_index(session, row, document, caches):
                    candidates.add(index_id)

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for index_id in sorted(candidates)
            if (report := await _verify_index(ctx, session, index_id, caches))
        ]

    logger.info("compared indexes", indexes=len(mongo_ids), drifted=len(drifted))

    return drifted


async def _verify_index(
    ctx: MigrationContext,
    session: AsyncSession,
    index_id: str,
    caches: _ResolutionCaches,
) -> dict | None:
    """Re-read one candidate index from both stores and report it if it still drifts.

    Returns ``None`` when the candidate turns out to agree after all, which happens
    when the application wrote or deleted the index between the reads that flagged it.
    """
    document = await ctx.mongo.indexes.find_one({"_id": index_id})

    row = (
        await session.execute(select(SQLIndex).where(SQLIndex.legacy_id == index_id))
    ).scalar_one_or_none()

    if document is None and row is None:
        return None

    if document is None:
        return {"index_id": index_id, "issue": "missing from mongo"}

    if row is None:
        return {"index_id": index_id, "issue": "missing from postgres"}

    differences = await _diff_index(session, row, document, caches)

    if differences:
        return {"index_id": index_id, "differences": differences}

    return None


async def _diff_index(
    session: AsyncSession,
    row: SQLIndex,
    document: Document,
    caches: _ResolutionCaches,
) -> dict[str, dict]:
    """Diff an ``indexes`` row against the Mongo document it mirrors.

    Reports by the fields that differ. Embedded ids are resolved to their Postgres
    keys before comparison; ``created_at`` is floored to the millisecond on both
    sides. See :func:`compare_index_stores` for the field-by-field contract.
    """
    differences: dict[str, dict] = {}

    if row.storage_key != document["_id"]:
        differences["storage_key"] = {
            "mongo": document["_id"],
            "postgres": row.storage_key,
        }

    if row.version != document["version"]:
        differences["version"] = {
            "mongo": document["version"],
            "postgres": row.version,
        }

    mongo_created_at = _floor_to_millisecond(document["created_at"])
    postgres_created_at = _floor_to_millisecond(row.created_at)

    if mongo_created_at != postgres_created_at:
        differences["created_at"] = {
            "mongo": mongo_created_at,
            "postgres": postgres_created_at,
        }

    if row.ready != document["ready"]:
        differences["ready"] = {"mongo": document["ready"], "postgres": row.ready}

    if row.manifest != document["manifest"]:
        differences["manifest"] = _diff_manifest(document["manifest"], row.manifest)

    reference_difference = await _diff_resolved_id(
        session,
        SQLReference,
        document["reference"]["id"],
        row.reference_id,
        caches.reference,
        "reference",
    )

    if reference_difference is not None:
        differences["reference"] = reference_difference

    user_difference = await _diff_resolved_id(
        session,
        SQLUser,
        document["user"]["id"],
        row.user_id,
        caches.user,
        "user",
    )

    if user_difference is not None:
        differences["user"] = user_difference

    job_difference = await _diff_job(session, row, document, caches.job)

    if job_difference is not None:
        differences["job"] = job_difference

    task = document.get("task")
    expected_task_id = task["id"] if task is not None else None

    if row.task_id != expected_task_id:
        differences["task"] = {"mongo": expected_task_id, "postgres": row.task_id}

    return differences


async def _diff_resolved_id(
    session: AsyncSession,
    model: HasLegacyAndModernIDs,
    embedded_id: int | str,
    actual_id: int,
    cache: dict[int | str, int],
    relationship: str,
) -> dict | None:
    """Diff a required embedded reference against the row's resolved foreign key.

    The embedded id may be a legacy string or a modern integer; both resolve to the
    same Postgres key, which is what the row must hold. An embedded id that does not
    resolve is reported: the relationship is required and its target is already
    migrated, so an unresolvable id is drift.
    """
    resolved = await _resolve(session, model, embedded_id, cache)

    if resolved is None:
        return {
            "issue": f"{relationship} missing from postgres",
            relationship: embedded_id,
        }

    if actual_id != resolved:
        return {"mongo": resolved, "postgres": actual_id}

    return None


async def _diff_job(
    session: AsyncSession,
    row: SQLIndex,
    document: Document,
    cache: dict[int | str, int],
) -> dict | None:
    """Diff an index's ``job_id`` against its Mongo ``job``.

    A job-backed index outlives the job that built it, so a Mongo ``job`` whose id no
    longer resolves in Postgres is expected to leave ``job_id`` null rather than
    drift. A Mongo job that does resolve must match ``job_id``; a task-backed index,
    which carries no ``job``, must hold a null one.
    """
    job = document.get("job")

    if job is None:
        if row.job_id is not None:
            return {"mongo": None, "postgres": row.job_id}
        return None

    job_id = await _resolve(session, SQLJob, job["id"], cache)

    if job_id is None:
        if row.job_id is not None:
            return {
                "issue": "mongo job unresolvable but postgres holds a job_id",
                "mongo": job["id"],
                "postgres": row.job_id,
            }
        return None

    if row.job_id != job_id:
        return {"mongo": job_id, "postgres": row.job_id}

    return None


def _diff_manifest(
    mongo_manifest: dict,
    postgres_manifest: dict,
) -> dict[str, list | dict]:
    """Summarise how two otu manifests differ, keeping a report readable.

    The pass/fail verdict is the whole-map comparison in :func:`_diff_index`; this
    only shapes the report of a manifest already known to differ into the otus added,
    removed or rewritten, so a large manifest does not have to be dumped whole.
    """
    mongo_keys = set(mongo_manifest)
    postgres_keys = set(postgres_manifest)

    return {
        "only_in_mongo": sorted(mongo_keys - postgres_keys),
        "only_in_postgres": sorted(postgres_keys - mongo_keys),
        "changed": {
            key: {"mongo": mongo_manifest[key], "postgres": postgres_manifest[key]}
            for key in sorted(mongo_keys & postgres_keys)
            if mongo_manifest[key] != postgres_manifest[key]
        },
    }


async def _resolve(
    session: AsyncSession,
    model: HasLegacyAndModernIDs,
    id_: int | str,
    cache: dict[int | str, int],
) -> int | None:
    """Resolve an embedded legacy or modern id to a Postgres key, memoising hits.

    Misses are not cached: the application keeps writing while a migration runs, so an
    id that does not resolve now may resolve on a later call.
    """
    if id_ in cache:
        return cache[id_]

    resolved = await resolve_legacy_id(session, model, id_)

    if resolved is not None:
        cache[id_] = resolved

    return resolved


def _floor_to_millisecond(created_at: datetime) -> datetime:
    """Drop a datetime's sub-millisecond precision, as a write to Mongo would."""
    return created_at.replace(microsecond=created_at.microsecond // 1000 * 1000)
