"""Backfill SQLite artifacts for ready indexes.

Capture the ready index set, skip indexes that already have a current SQLite artifact
row, and create missing artifacts from the reference v2 JSON, OTU JSON, or recorded
manifest and history. Each index commits independently so rerunning the revision skips
work that already completed successfully.

Revision ID: 5hnwczwh7skv
Date: 2026-08-10 21:52:02.121690

"""

import asyncio
import gzip
from collections.abc import AsyncIterator, Mapping
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import arrow
import orjson
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.indexes.db import (
    REFERENCE_JSON_V2_FILE_NAME,
    iter_patched_otus,
)
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.migration import MigrationContext
from virtool.references.sql import SQLReference
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
)
from virtool.storage.cleanup import delete_keys
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.file import read_file_chunks
from virtool.storage.keys import mint_storage_key

logger = get_logger("migration")

_SOURCE_REFERENCE_V2 = "reference-v2.json.gz"
_SOURCE_OTUS_JSON = "otus.json.gz"
_SOURCE_HISTORY = "manifest-history"


class _SourceUnavailableError(Exception):
    """Raised when an index does not have a requested backfill source."""


# Revision identifiers.
name = "Backfill SQLite artifacts for ready indexes"
created_at = arrow.get("2026-08-10 21:52:02.121690")
revision_id = "5hnwczwh7skv"

alembic_down_revision = None
virtool_down_revision = "22klaq3y66sm"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def _decode_gzip_json(ctx: MigrationContext, key: str) -> object:
    compressed = b"".join([chunk async for chunk in ctx.storage.read(key)])
    decompressed = await asyncio.to_thread(gzip.decompress, compressed)
    return await asyncio.to_thread(orjson.loads, decompressed)


async def _async_iter_materialized_otus(
    otus: list[Mapping[str, Any]],
) -> AsyncIterator[Mapping[str, Any]]:
    for otu in otus:
        yield otu


def _shape_reference(reference: SQLReference) -> dict[str, Any]:
    return {
        "_id": reference.id,
        "created_at": reference.created_at,
        "data_type": "genome",
        "name": reference.name,
        "organism": reference.organism,
    }


async def _load_reference_v2_snapshot(
    ctx: MigrationContext,
    index_id: int,
) -> tuple[Mapping[str, Any], AsyncIterator[Mapping[str, Any]]]:
    async with AsyncSession(ctx.pg) as session:
        key = await session.scalar(
            select(SQLIndexFile.storage_key).where(
                SQLIndexFile.index_id == index_id,
                SQLIndexFile.name == REFERENCE_JSON_V2_FILE_NAME,
            ),
        )

    if key is None:
        raise _SourceUnavailableError("index file row does not exist")

    try:
        snapshot = await _decode_gzip_json(ctx, key)
    except StorageKeyNotFoundError as exc:
        raise _SourceUnavailableError("recorded object does not exist") from exc

    if not isinstance(snapshot, dict):
        raise TypeError("reference-v2.json.gz must contain a JSON object")

    otus = snapshot["otus"]

    if not isinstance(otus, list):
        raise TypeError("reference-v2.json.gz otus must be a JSON list")

    return snapshot, _async_iter_materialized_otus(otus)


async def _load_otus_json(
    ctx: MigrationContext,
    index: SQLIndex,
) -> AsyncIterator[Mapping[str, Any]]:
    if index.otus_json_storage_key is None:
        raise _SourceUnavailableError("index has no OTU JSON storage key")

    try:
        otus = await _decode_gzip_json(ctx, index.otus_json_storage_key)
    except StorageKeyNotFoundError as exc:
        raise _SourceUnavailableError("recorded object does not exist") from exc

    if not isinstance(otus, list):
        raise TypeError("otus.json.gz must contain a JSON list")

    return _async_iter_materialized_otus(otus)


async def _load_manifest_history(
    ctx: MigrationContext,
    index: SQLIndex,
) -> AsyncIterator[Mapping[str, Any]]:
    if not isinstance(index.manifest, dict):
        raise TypeError("index manifest must be a JSON object")

    return iter_patched_otus(ctx.pg, index.manifest)


async def _try_backfill_sources(
    ctx: MigrationContext,
    index: SQLIndex,
    reference: SQLReference,
    temp_path: Path,
) -> tuple[Path, str]:
    postgres_reference = _shape_reference(reference)

    async def create_from_reference_v2(path: Path) -> None:
        candidate_reference, candidate_otus = await _load_reference_v2_snapshot(
            ctx,
            index.id,
        )
        await SQLiteReference.create(path, candidate_reference, candidate_otus)

    async def create_from_otus_json(path: Path) -> None:
        candidate_otus = await _load_otus_json(ctx, index)
        await SQLiteReference.create(path, postgres_reference, candidate_otus)

    async def create_from_manifest_history(path: Path) -> None:
        candidate_otus = await _load_manifest_history(ctx, index)
        await SQLiteReference.create(path, postgres_reference, candidate_otus)

    candidate_creators = (
        (
            _SOURCE_REFERENCE_V2,
            "reference-v2",
            create_from_reference_v2,
        ),
        (
            _SOURCE_OTUS_JSON,
            "otus-json",
            create_from_otus_json,
        ),
        (
            _SOURCE_HISTORY,
            "manifest-history",
            create_from_manifest_history,
        ),
    )

    for source, candidate_name, create_candidate in candidate_creators:
        candidate_path = temp_path / f"candidate-{candidate_name}.sqlite"

        try:
            await create_candidate(candidate_path)
        except _SourceUnavailableError as exc:
            logger.warning(
                "SQLite artifact backfill source unavailable",
                index_id=index.id,
                source=source,
                error=str(exc),
            )
        except Exception as exc:
            logger.error(
                "SQLite artifact backfill source failed",
                index_id=index.id,
                source=source,
                error=repr(exc),
            )
        else:
            return candidate_path, source

    raise RuntimeError("all SQLite artifact backfill sources failed")


async def _cleanup_storage_key(
    ctx: MigrationContext,
    key: str,
    *,
    index_id: int,
) -> None:
    for failed_key, exc in await delete_keys(ctx.storage, [key]):
        logger.error(
            "SQLite artifact storage cleanup failed",
            index_id=index_id,
            key=failed_key,
            error=repr(exc),
        )


async def _publish_candidate(
    ctx: MigrationContext,
    index_id: int,
    candidate_path: Path,
) -> None:
    key = mint_storage_key("indexes", index_id)
    size = await ctx.storage.write(key, read_file_chunks(candidate_path))

    try:
        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLIndexFile(
                    index_id=index_id,
                    name=REFERENCE_SQLITE_FILE_NAME,
                    size=size,
                    storage_key=key,
                    type="sqlite",
                ),
            )
            await session.commit()
    except Exception:
        await _cleanup_storage_key(ctx, key, index_id=index_id)
        raise


async def _get_index_and_reference(
    ctx: MigrationContext,
    index_id: int,
) -> tuple[SQLIndex, SQLReference]:
    async with AsyncSession(ctx.pg) as session:
        row = (
            await session.execute(
                select(SQLIndex, SQLReference)
                .join(SQLReference, SQLIndex.reference_id == SQLReference.id)
                .where(SQLIndex.id == index_id),
            )
        ).one_or_none()

    if row is None:
        raise RuntimeError("captured ready index or its reference no longer exists")

    return row


async def _has_sqlite_file_row(
    ctx: MigrationContext,
    index_id: int,
) -> bool:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.scalar(
                select(SQLIndexFile.id).where(
                    SQLIndexFile.index_id == index_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                ),
            )
            is not None
        )


async def _backfill_index(ctx: MigrationContext, index_id: int) -> None:
    logger.info("SQLite artifact backfill started", index_id=index_id)

    if await _has_sqlite_file_row(ctx, index_id):
        logger.info(
            "SQLite artifact backfill completed",
            index_id=index_id,
            outcome="skipped",
        )
        return

    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        index, reference = await _get_index_and_reference(ctx, index_id)
        candidate_path, source = await _try_backfill_sources(
            ctx,
            index,
            reference,
            temp_path,
        )
        await _publish_candidate(ctx, index_id, candidate_path)

    logger.info(
        "SQLite artifact backfill completed",
        index_id=index_id,
        outcome="rebuilt",
        source=source,
    )


async def upgrade(ctx: MigrationContext) -> None:
    """Create a current-format SQLite artifact for every ready index missing one."""
    async with AsyncSession(ctx.pg) as session:
        index_ids = list(
            (
                await session.scalars(
                    select(SQLIndex.id).where(SQLIndex.ready.is_(True)),
                )
            ).all(),
        )

    failed_index_ids = []

    for index_id in index_ids:
        try:
            await _backfill_index(ctx, index_id)
        except Exception as exc:
            failed_index_ids.append(index_id)
            logger.error(
                "SQLite artifact backfill failed",
                index_id=index_id,
                outcome="failed",
                error=repr(exc),
            )

    if failed_index_ids:
        failed = ", ".join(str(index_id) for index_id in failed_index_ids)
        raise RuntimeError(f"SQLite artifact backfill failed for indexes: {failed}")
