"""Shared backfill logic for copying Mongo subtractions into Postgres.

This module holds the idempotent copy used by both the original subtraction
backfill revision and the later re-backfill revision. Keeping it here lets both
revisions share a single implementation instead of duplicating ~300 lines.
"""

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import compose_legacy_id_single_expression
from virtool.jobs.pg import SQLJob
from virtool.migration import MigrationContext
from virtool.pg.base import Base
from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile, SubtractionType
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.users.pg import SQLUser

logger = get_logger("migration")

UNKNOWN_USER_HANDLE = "unknown"


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
    ``user`` and ``job`` references that no longer resolve to a Postgres row are
    backfilled as ``NULL`` and logged with a warning. These collections used to be
    deletable, so legacy subtractions can reference rows that have since been
    removed, and ``NULL`` is the truthful mapping.

    A subtraction is always built from a source FASTA upload, so its upload
    relation must always hold. When the referenced ``upload`` no longer resolves,
    a stand-in ``removed`` upload is rebuilt from the Mongo ``file`` snapshot
    rather than backfilled as ``NULL``, so the read path never sees a null
    ``file``. See :func:`_resolve_upload_id`.

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
        unknown_user_id_cache: dict[str, int] = {}

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
            upload_id = await _resolve_upload_id(
                session,
                document,
                upload_id_cache,
                user_id,
                unknown_user_id_cache,
            )

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
    user_id: int | None,
    unknown_user_cache: dict[str, int],
) -> int:
    """Resolve a document's upload to a Postgres ``uploads.id``, rebuilding if gone.

    A subtraction is always built from a source FASTA upload, so the
    subtraction-to-upload relation must always hold. When the referenced upload
    still exists its id is returned directly. When it does not -- the upload was
    deleted, or the document predates the integer ``upload`` field -- a stand-in
    ``removed`` upload is rebuilt from the Mongo ``file`` snapshot so the relation
    is preserved and the read path never sees a null ``file``.

    The reconstructed upload is attributed to the subtraction's ``user_id``, or to
    the ``unknown`` sentinel user when that user was itself deleted.
    """
    reference = document.get("upload")

    if reference is None:
        file_id = (document.get("file") or {}).get("id")
        if isinstance(file_id, int):
            reference = file_id

    if reference is not None:
        upload_id = await _resolve_id(session, SQLUpload, reference, cache)
        if upload_id is not None:
            return upload_id

        logger.warning(
            "subtraction references an upload that no longer exists; "
            "reconstructing a removed upload",
            subtraction_id=document["_id"],
            upload=reference,
        )

    attribution_user_id = (
        user_id
        if user_id is not None
        else await _get_unknown_user_id(session, unknown_user_cache)
    )

    return await _reconstruct_removed_upload(session, document, attribution_user_id)


async def _get_unknown_user_id(
    session: AsyncSession,
    cache: dict[str, int],
) -> int:
    """Return the id of the ``unknown`` sentinel user, raising if it is absent.

    Orphaned uploads whose owning user was also deleted are attributed to this
    sentinel so the non-null ``uploads.user_id`` constraint holds. The sentinel is
    created out of band -- a login-disabled user with handle ``unknown``. A
    missing one is a loud failure rather than a silent null, because skipping
    attribution would leave the subtraction without the linked upload the read
    path requires.
    """
    if UNKNOWN_USER_HANDLE in cache:
        return cache[UNKNOWN_USER_HANDLE]

    user_id = (
        await session.execute(
            select(SQLUser.id).where(
                func.lower(SQLUser.handle) == UNKNOWN_USER_HANDLE,
            ),
        )
    ).scalar_one_or_none()

    if user_id is None:
        msg = (
            "the 'unknown' sentinel user is required to attribute orphaned "
            "subtraction uploads but was not found; create a login-disabled user "
            "with handle 'unknown' before running this migration"
        )
        raise ValueError(msg)

    cache[UNKNOWN_USER_HANDLE] = user_id

    return user_id


async def _reconstruct_removed_upload(
    session: AsyncSession,
    document: dict,
    user_id: int,
) -> int:
    """Insert a stand-in ``removed`` upload for a subtraction whose upload is gone.

    The blob no longer exists, so the row is flagged ``removed``. The name comes
    from the Mongo ``file`` snapshot, and the size from the subtraction's FASTA
    ``subtraction_files`` row when one is present. Timestamps fall back to the
    subtraction's ``created_at`` because the original upload times are lost.
    Returns the new upload id.
    """
    legacy_id = document["_id"]
    file = document.get("file") or {}
    name = file.get("name") or f"{document['name']}.fa.gz"
    created_at = document["created_at"]

    size = (
        await session.execute(
            select(SQLSubtractionFile.size)
            .where(
                SQLSubtractionFile.subtraction == legacy_id,
                SQLSubtractionFile.type == SubtractionType.fasta,
            )
            .limit(1),
        )
    ).scalar_one_or_none()

    upload_id = (
        await session.execute(
            insert(SQLUpload)
            .values(
                name=name,
                name_on_disk=f"reconstructed-upload-{legacy_id}",
                ready=True,
                removed=True,
                removed_at=created_at,
                reserved=False,
                size=size,
                type=UploadType.subtraction,
                user_id=user_id,
                created_at=created_at,
                uploaded_at=created_at,
            )
            .returning(SQLUpload.id),
        )
    ).scalar_one()

    logger.info(
        "reconstructed removed upload for subtraction",
        subtraction_id=legacy_id,
        upload_id=upload_id,
    )

    return upload_id


async def repair_null_subtraction_uploads(ctx: MigrationContext) -> None:
    """Reconstruct uploads for already-migrated subtractions with a null upload_id.

    The original backfill wrote ``upload_id = NULL`` for subtractions whose source
    upload had been deleted, which makes the read path raise because ``file`` is a
    required field. This pass rebuilds a ``removed`` stand-in upload for every
    non-deleted subtraction still carrying a null ``upload_id`` and links it, so
    the subtraction-to-upload relation holds and listings stop failing.

    Each subtraction is re-resolved first, so an upload that has since reappeared
    in Postgres is linked instead of duplicated. Soft-deleted subtractions are
    skipped because the read path filters them out and they never trigger the bug.

    Idempotent: only rows with a null ``upload_id`` are touched, so a re-run after
    a complete pass is a no-op.
    """
    upload_id_cache: dict[int | str, int | None] = {}
    unknown_user_cache: dict[str, int] = {}
    repaired_count = 0

    async with AsyncSession(ctx.pg) as session:
        rows = (
            await session.execute(
                select(
                    SQLSubtraction.id,
                    SQLSubtraction.legacy_id,
                    SQLSubtraction.user_id,
                ).where(
                    SQLSubtraction.upload_id.is_(None),
                    SQLSubtraction.deleted.is_(False),
                ),
            )
        ).all()

        for subtraction_pk, legacy_id, user_id in rows:
            if legacy_id is None:
                continue

            document = await ctx.mongo.subtraction.find_one({"_id": legacy_id})

            if document is None:
                logger.warning(
                    "subtraction has no mongo document; cannot reconstruct upload",
                    subtraction_id=legacy_id,
                )
                continue

            upload_id = await _resolve_upload_id(
                session,
                document,
                upload_id_cache,
                user_id,
                unknown_user_cache,
            )

            await session.execute(
                update(SQLSubtraction)
                .where(SQLSubtraction.id == subtraction_pk)
                .values(upload_id=upload_id),
            )
            await session.commit()

            repaired_count += 1

    logger.info("repaired null subtraction upload ids", repaired=repaired_count)


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
