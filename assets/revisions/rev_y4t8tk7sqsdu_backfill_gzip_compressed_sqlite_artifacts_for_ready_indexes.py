"""Backfill gzip compressed SQLite artifacts for ready indexes.

Revision ID: y4t8tk7sqsdu
Date: 2026-08-17 18:29:05.359847

"""

from pathlib import Path
from tempfile import TemporaryDirectory

import aiofiles
import arrow
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.migration import MigrationContext
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_GZIP_FILE_NAME,
    SQLiteReference,
)
from virtool.storage.file import read_file_chunks
from virtool.storage.keys import mint_storage_key
from virtool.utils import compress_file_with_gzip, decompress_file_with_gzip

logger = get_logger("migration")

# Revision identifiers.
name = "Backfill gzip compressed SQLite artifacts for ready indexes"
created_at = arrow.get("2026-08-17 18:29:05.359847")
revision_id = "y4t8tk7sqsdu"

alembic_down_revision = None
virtool_down_revision = "5hnwczwh7skv"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def _download(
    ctx: MigrationContext,
    key: str,
    path: Path,
    expected_size: int | None,
) -> None:
    if expected_size is None:
        raise RuntimeError("index file row does not record a size")

    storage_size = await ctx.storage.size(key)

    if storage_size != expected_size:
        raise RuntimeError(
            f"recorded size {expected_size} does not match storage size {storage_size}"
        )

    downloaded_size = 0

    async with aiofiles.open(path, "wb") as handle:
        async for chunk in ctx.storage.read(key):
            downloaded_size += len(chunk)
            await handle.write(chunk)

    if downloaded_size != expected_size:
        raise RuntimeError(
            f"recorded size {expected_size} does not match downloaded size "
            f"{downloaded_size}"
        )


async def _validate_sqlite(path: Path) -> None:
    sqlite_reference = SQLiteReference.load(path)
    await sqlite_reference.validate()


async def _validate_compressed(
    ctx: MigrationContext,
    row: SQLIndexFile,
    temp_path: Path,
) -> bool:
    if row.type != "sqlite":
        return False

    gzip_path = temp_path / "existing.sqlite.gz"
    sqlite_path = temp_path / "existing.sqlite"

    try:
        await _download(ctx, row.storage_key, gzip_path, row.size)
        decompress_file_with_gzip(gzip_path, sqlite_path)
        await _validate_sqlite(sqlite_path)
    except Exception as exc:
        logger.warning(
            "compressed SQLite artifact is invalid",
            index_id=row.index_id,
            key=row.storage_key,
            error=repr(exc),
        )
        return False

    return True


async def _get_artifact_rows(
    ctx: MigrationContext,
    index_id: int,
) -> tuple[SQLIndexFile | None, SQLIndexFile | None]:
    async with AsyncSession(ctx.pg) as session:
        rows = (
            (
                await session.scalars(
                    select(SQLIndexFile).where(
                        SQLIndexFile.index_id == index_id,
                        SQLIndexFile.name.in_(
                            (
                                REFERENCE_SQLITE_FILE_NAME,
                                REFERENCE_SQLITE_GZIP_FILE_NAME,
                            )
                        ),
                    )
                )
            )
            .unique()
            .all()
        )

    rows_by_name = {row.name: row for row in rows}

    return (
        rows_by_name.get(REFERENCE_SQLITE_FILE_NAME),
        rows_by_name.get(REFERENCE_SQLITE_GZIP_FILE_NAME),
    )


async def _publish_compressed_row(
    ctx: MigrationContext,
    index_id: int,
    key: str,
    size: int,
) -> None:
    async with AsyncSession(ctx.pg) as session, session.begin():
        await session.execute(
            pg_insert(SQLIndexFile)
            .values(
                index_id=index_id,
                name=REFERENCE_SQLITE_GZIP_FILE_NAME,
                size=size,
                storage_key=key,
                type="sqlite",
            )
            .on_conflict_do_update(
                index_elements=[SQLIndexFile.index_id, SQLIndexFile.name],
                set_={"size": size, "storage_key": key, "type": "sqlite"},
            )
        )


async def _delete_raw_artifact(
    ctx: MigrationContext,
    row: SQLIndexFile,
) -> None:
    await ctx.storage.delete(row.storage_key)

    async with AsyncSession(ctx.pg) as session, session.begin():
        result = await session.execute(
            delete(SQLIndexFile).where(
                SQLIndexFile.id == row.id,
                SQLIndexFile.index_id == row.index_id,
                SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                SQLIndexFile.storage_key == row.storage_key,
            )
        )

        if result.rowcount != 1:
            message = "raw SQLite artifact row changed during migration"
            raise RuntimeError(message)


async def _cleanup_candidate(
    ctx: MigrationContext,
    key: str,
    *,
    index_id: int,
) -> None:
    try:
        await ctx.storage.delete(key)
    except Exception as exc:
        logger.error(
            "compressed SQLite candidate cleanup failed",
            index_id=index_id,
            key=key,
            error=repr(exc),
        )


async def _rebuild_compressed(
    ctx: MigrationContext,
    index_id: int,
    raw_row: SQLIndexFile,
    compressed_row: SQLIndexFile | None,
    temp_path: Path,
) -> None:
    if raw_row.type != "sqlite":
        raise RuntimeError("raw SQLite artifact row has an invalid type")

    raw_path = temp_path / REFERENCE_SQLITE_FILE_NAME
    gzip_path = temp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
    uploaded_gzip_path = temp_path / "uploaded.sqlite.gz"
    uploaded_validation_path = temp_path / "uploaded-validation.sqlite"

    await _download(ctx, raw_row.storage_key, raw_path, raw_row.size)
    await _validate_sqlite(raw_path)

    compress_file_with_gzip(raw_path, gzip_path)

    key = mint_storage_key("indexes", index_id)

    try:
        uploaded_size = await ctx.storage.write(key, read_file_chunks(gzip_path))
        local_size = gzip_path.stat().st_size

        if uploaded_size != local_size:
            raise RuntimeError(
                f"uploaded size {uploaded_size} does not match local size {local_size}"
            )

        await _download(ctx, key, uploaded_gzip_path, uploaded_size)
        decompress_file_with_gzip(uploaded_gzip_path, uploaded_validation_path)
        await _validate_sqlite(uploaded_validation_path)

        if compressed_row is not None:
            await ctx.storage.delete(compressed_row.storage_key)

        await _publish_compressed_row(ctx, index_id, key, uploaded_size)
    except BaseException:
        await _cleanup_candidate(ctx, key, index_id=index_id)
        raise


async def _migrate_index(ctx: MigrationContext, index_id: int) -> None:
    logger.info("compressed SQLite artifact migration started", index_id=index_id)

    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        raw_row, compressed_row = await _get_artifact_rows(ctx, index_id)
        compressed_is_valid = compressed_row is not None and await _validate_compressed(
            ctx,
            compressed_row,
            temp_path,
        )

        if compressed_is_valid:
            outcome = "skipped" if raw_row is None else "cleaned"
        else:
            if raw_row is None:
                raise RuntimeError("index has no usable raw SQLite artifact")

            await _rebuild_compressed(
                ctx,
                index_id,
                raw_row,
                compressed_row,
                temp_path,
            )
            outcome = "replaced"

        if raw_row is not None:
            await _delete_raw_artifact(ctx, raw_row)

    logger.info(
        "compressed SQLite artifact migration completed",
        index_id=index_id,
        outcome=outcome,
    )


async def upgrade(ctx: MigrationContext) -> None:
    """Replace raw SQLite artifacts for ready indexes with gzip artifacts."""
    async with AsyncSession(ctx.pg) as session:
        index_ids = list(
            (
                await session.scalars(
                    select(SQLIndex.id).where(SQLIndex.ready.is_(True))
                )
            ).all()
        )

    failed_index_ids = []

    for index_id in index_ids:
        try:
            await _migrate_index(ctx, index_id)
        except Exception as exc:
            failed_index_ids.append(index_id)
            logger.error(
                "compressed SQLite artifact migration failed",
                index_id=index_id,
                error=repr(exc),
            )

    if failed_index_ids:
        failed = ", ".join(str(index_id) for index_id in failed_index_ids)
        raise RuntimeError(
            f"compressed SQLite artifact migration failed for indexes: {failed}"
        )
