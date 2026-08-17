"""Tests for replacing ready-index raw SQLite artifacts with gzip artifacts."""

import asyncio
from collections.abc import AsyncIterator, Callable
from datetime import datetime
from pathlib import Path

import aiofiles
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import assets.revisions.rev_y4t8tk7sqsdu_backfill_gzip_compressed_sqlite_artifacts_for_ready_indexes as revision
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.migration.ctx import MigrationContext
from virtool.references.sql import SQLReference
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_GZIP_FILE_NAME,
    SQLiteReference,
)
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.file import read_file_chunks
from virtool.users.pg import SQLUser
from virtool.utils import compress_file_with_gzip, decompress_file_with_gzip

CREATED_AT = datetime(2020, 1, 2, 3, 4, 5)


@pytest.fixture(autouse=True)
async def _current_schema(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic)


async def _write_bytes(ctx: MigrationContext, key: str, data: bytes) -> int:
    async def chunks() -> AsyncIterator[bytes]:
        yield data

    return await ctx.storage.write(key, chunks())


async def _seed_index(
    ctx: MigrationContext,
    label: str,
    *,
    ready: bool = True,
) -> int:
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle=f"user-{label}",
            last_password_change=CREATED_AT,
            password=b"hashed",
            settings={},
        )
        session.add(user)
        await session.flush()

        reference = SQLReference(
            name=f"Reference {label}",
            description="Reference used by migration tests",
            organism=f"Organism {label}",
            created_at=CREATED_AT,
            source_types=[],
            user_id=user.id,
        )
        session.add(reference)
        await session.flush()

        index = SQLIndex(
            version=0,
            created_at=CREATED_AT,
            manifest={f"otu-{label}": 0},
            ready=ready,
            storage_key=f"legacy-index-prefix-{label}",
            reference_id=reference.id,
            user_id=user.id,
        )
        session.add(index)
        await session.flush()
        index_id = index.id
        await session.commit()

    return index_id


async def _insert_file(
    ctx: MigrationContext,
    index_id: int,
    name: str,
    key: str,
    *,
    file_type: str,
    size: int | None,
) -> int:
    async with AsyncSession(ctx.pg) as session:
        row = SQLIndexFile(
            index_id=index_id,
            name=name,
            storage_key=key,
            type=file_type,
            size=size,
        )
        session.add(row)
        await session.flush()
        row_id = row.id
        await session.commit()

    return row_id


async def _create_sqlite(path: Path, label: str) -> None:
    async def otus() -> AsyncIterator[dict]:
        if False:
            yield {}

    await SQLiteReference.create(
        path,
        {
            "_id": f"reference-{label}",
            "created_at": "2020-01-02T03:04:05Z",
            "data_type": "genome",
            "name": f"Reference {label}",
            "organism": f"Organism {label}",
        },
        otus(),
    )


async def _add_raw(
    ctx: MigrationContext,
    index_id: int,
    temp_path: Path,
    label: str,
) -> tuple[int, str, int]:
    path = temp_path / f"{label}.sqlite"
    await _create_sqlite(path, label)
    key = f"indexes/{index_id}/raw-{label}"
    size = await ctx.storage.write(key, read_file_chunks(path))
    row_id = await _insert_file(
        ctx,
        index_id,
        REFERENCE_SQLITE_FILE_NAME,
        key,
        file_type="sqlite",
        size=size,
    )
    return row_id, key, size


async def _add_gzip(
    ctx: MigrationContext,
    index_id: int,
    temp_path: Path,
    label: str,
) -> tuple[int, str, int]:
    sqlite_path = temp_path / f"{label}-gzip-source.sqlite"
    gzip_path = temp_path / f"{label}.sqlite.gz"
    await _create_sqlite(sqlite_path, label)
    compress_file_with_gzip(sqlite_path, gzip_path)
    key = f"indexes/{index_id}/gzip-{label}"
    size = await ctx.storage.write(key, read_file_chunks(gzip_path))
    row_id = await _insert_file(
        ctx,
        index_id,
        REFERENCE_SQLITE_GZIP_FILE_NAME,
        key,
        file_type="sqlite",
        size=size,
    )
    return row_id, key, size


async def _get_file(
    ctx: MigrationContext,
    index_id: int,
    name: str,
) -> SQLIndexFile | None:
    async with AsyncSession(ctx.pg) as session:
        return await session.scalar(
            select(SQLIndexFile).where(
                SQLIndexFile.index_id == index_id,
                SQLIndexFile.name == name,
            )
        )


async def _assert_missing(ctx: MigrationContext, key: str) -> None:
    with pytest.raises(StorageKeyNotFoundError):
        await ctx.storage.size(key)


async def _assert_valid_gzip(
    ctx: MigrationContext,
    row: SQLIndexFile,
    temp_path: Path,
) -> None:
    gzip_path = temp_path / f"result-{row.index_id}.sqlite.gz"
    sqlite_path = temp_path / f"result-{row.index_id}.sqlite"

    async with aiofiles.open(gzip_path, "wb") as handle:
        async for chunk in ctx.storage.read(row.storage_key):
            await handle.write(chunk)

    decompress_file_with_gzip(gzip_path, sqlite_path)
    sqlite_reference = SQLiteReference.load(sqlite_path)
    await sqlite_reference.validate()


class TestReplacement:
    async def test_replaces_raw_artifact_and_preserves_index_state(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "replacement")
        _, raw_key, _ = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "replacement",
        )

        async with AsyncSession(ctx.pg) as session:
            before = (
                await session.execute(
                    select(
                        SQLIndex.ready,
                        SQLIndex.manifest,
                        SQLIndex.storage_key,
                        SQLIndex.otus_json_storage_key,
                        SQLIndex.reference_id,
                        SQLIndex.user_id,
                        SQLIndex.job_id,
                        SQLIndex.task_id,
                    ).where(SQLIndex.id == index_id)
                )
            ).one()

        await revision.upgrade(ctx)

        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is None
        await _assert_missing(ctx, raw_key)

        gzip_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert gzip_row is not None
        assert gzip_row.type == "sqlite"
        assert gzip_row.size == await ctx.storage.size(gzip_row.storage_key)
        await _assert_valid_gzip(ctx, gzip_row, tmp_path)

        async with AsyncSession(ctx.pg) as session:
            after = (
                await session.execute(
                    select(
                        SQLIndex.ready,
                        SQLIndex.manifest,
                        SQLIndex.storage_key,
                        SQLIndex.otus_json_storage_key,
                        SQLIndex.reference_id,
                        SQLIndex.user_id,
                        SQLIndex.job_id,
                        SQLIndex.task_id,
                    ).where(SQLIndex.id == index_id)
                )
            ).one()

        assert after == before

        await revision.upgrade(ctx)

        second_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert second_row.storage_key == gzip_row.storage_key

    async def test_valid_gzip_finishes_pending_raw_cleanup_without_replacement(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "pending-cleanup")
        _, raw_key, _ = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "pending-cleanup",
        )
        gzip_row_id, gzip_key, _ = await _add_gzip(
            ctx,
            index_id,
            tmp_path,
            "pending-cleanup",
        )
        write = mocker.spy(ctx.storage, "write")

        await revision.upgrade(ctx)

        assert write.call_count == 0
        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is None
        await _assert_missing(ctx, raw_key)
        gzip_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert gzip_row.id == gzip_row_id
        assert gzip_row.storage_key == gzip_key

    async def test_repairs_corrupt_compressed_artifact(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "repair")
        _, raw_key, _ = await _add_raw(ctx, index_id, tmp_path, "repair")
        old_gzip_key = f"indexes/{index_id}/corrupt-gzip"
        old_gzip_size = await _write_bytes(ctx, old_gzip_key, b"not gzip")
        old_row_id = await _insert_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
            old_gzip_key,
            file_type="sqlite",
            size=old_gzip_size,
        )

        await revision.upgrade(ctx)

        gzip_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert gzip_row.id == old_row_id
        assert gzip_row.storage_key != old_gzip_key
        await _assert_valid_gzip(ctx, gzip_row, tmp_path)
        await _assert_missing(ctx, old_gzip_key)
        await _assert_missing(ctx, raw_key)


class TestRawSourceFailures:
    async def test_missing_raw_source_fails(self, ctx: MigrationContext) -> None:
        index_id = await _seed_index(ctx, "missing-raw")

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_GZIP_FILE_NAME) is None

    async def test_corrupt_raw_source_is_preserved(
        self,
        ctx: MigrationContext,
    ) -> None:
        index_id = await _seed_index(ctx, "corrupt-raw")
        raw_key = f"indexes/{index_id}/corrupt-raw"
        raw_size = await _write_bytes(ctx, raw_key, b"not sqlite")
        raw_row_id = await _insert_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_FILE_NAME,
            raw_key,
            file_type="sqlite",
            size=raw_size,
        )

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        raw_row = await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME)
        assert raw_row.id == raw_row_id
        assert await ctx.storage.size(raw_key) == raw_size
        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_GZIP_FILE_NAME) is None

    async def test_size_mismatched_raw_source_is_preserved(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "size-mismatch")
        _, raw_key, raw_size = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "size-mismatch",
        )

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                update(SQLIndexFile)
                .where(
                    SQLIndexFile.index_id == index_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                )
                .values(size=raw_size + 1)
            )
            await session.commit()

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        assert await ctx.storage.size(raw_key) == raw_size
        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is not None


class TestRetry:
    async def test_publication_failure_cleans_candidate_and_retries(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "publish-retry")
        _, raw_key, raw_size = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "publish-retry",
        )
        publication = mocker.patch.object(
            revision,
            "_publish_compressed_row",
            side_effect=RuntimeError("database interrupted"),
        )

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        assert await ctx.storage.size(raw_key) == raw_size
        assert {
            item.key async for item in ctx.storage.list(f"indexes/{index_id}/")
        } == {raw_key}
        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_GZIP_FILE_NAME) is None

        mocker.stop(publication)
        await revision.upgrade(ctx)

        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is None
        assert (
            await _get_file(ctx, index_id, REFERENCE_SQLITE_GZIP_FILE_NAME) is not None
        )

    async def test_raw_row_failure_retries_after_blob_was_deleted(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "raw-delete-retry")
        _, raw_key, _ = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "raw-delete-retry",
        )
        original_delete = revision._delete_raw_artifact

        async def fail_after_blob_delete(ctx_: MigrationContext, row) -> None:
            await ctx_.storage.delete(row.storage_key)
            raise RuntimeError("database interrupted")

        raw_delete = mocker.patch.object(
            revision,
            "_delete_raw_artifact",
            side_effect=fail_after_blob_delete,
        )

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        await _assert_missing(ctx, raw_key)
        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is not None
        gzip_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert gzip_row is not None

        mocker.stop(raw_delete)
        assert revision._delete_raw_artifact is original_delete
        await revision.upgrade(ctx)

        assert await _get_file(ctx, index_id, REFERENCE_SQLITE_FILE_NAME) is None
        second_gzip_row = await _get_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )
        assert second_gzip_row.storage_key == gzip_row.storage_key


class TestScopeAndTransfer:
    async def test_captured_scope_and_failures_are_isolated(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        successful_id = await _seed_index(ctx, "successful")
        await _add_raw(ctx, successful_id, tmp_path, "successful")
        failed_first_id = await _seed_index(ctx, "failed-first")
        failed_second_id = await _seed_index(ctx, "failed-second")
        pending_id = await _seed_index(ctx, "became-ready", ready=False)
        _, pending_raw_key, pending_raw_size = await _add_raw(
            ctx,
            pending_id,
            tmp_path,
            "became-ready",
        )
        original_migrate = revision._migrate_index
        pending_marked = False

        async def mark_pending_ready(ctx_: MigrationContext, index_id: int) -> None:
            nonlocal pending_marked

            if not pending_marked:
                async with AsyncSession(ctx_.pg) as session:
                    await session.execute(
                        update(SQLIndex)
                        .where(SQLIndex.id == pending_id)
                        .values(ready=True)
                    )
                    await session.commit()
                pending_marked = True

            await original_migrate(ctx_, index_id)

        mocker.patch.object(revision, "_migrate_index", side_effect=mark_pending_ready)

        expected = f"{failed_first_id}, {failed_second_id}"
        with pytest.raises(RuntimeError, match=expected):
            await revision.upgrade(ctx)

        assert (
            await _get_file(
                ctx,
                successful_id,
                REFERENCE_SQLITE_GZIP_FILE_NAME,
            )
            is not None
        )
        assert await _get_file(ctx, successful_id, REFERENCE_SQLITE_FILE_NAME) is None
        assert (
            await _get_file(
                ctx,
                pending_id,
                REFERENCE_SQLITE_GZIP_FILE_NAME,
            )
            is None
        )
        assert await ctx.storage.size(pending_raw_key) == pending_raw_size

    async def test_downloads_and_uploads_in_bounded_chunks(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        index_id = await _seed_index(ctx, "bounded-transfer")
        _, raw_key, _ = await _add_raw(
            ctx,
            index_id,
            tmp_path,
            "bounded-transfer",
        )
        original_read = ctx.storage.read
        original_write = ctx.storage.write
        downloaded_chunks: dict[str, list[bytes]] = {}
        uploaded_chunks: list[bytes] = []
        chunk_size = 64

        async def read(key: str) -> AsyncIterator[bytes]:
            async for chunk in original_read(key):
                downloaded_chunks.setdefault(key, []).append(chunk)
                yield chunk

        async def write(key: str, data: AsyncIterator[bytes]) -> int:
            async def capture() -> AsyncIterator[bytes]:
                async for chunk in data:
                    uploaded_chunks.append(chunk)
                    yield chunk

            return await original_write(key, capture())

        mocker.patch("virtool.storage.memory.STORAGE_CHUNK_SIZE", chunk_size)
        mocker.patch("virtool.storage.file.STORAGE_CHUNK_SIZE", chunk_size)
        mocker.patch.object(ctx.storage, "read", side_effect=read)
        mocker.patch.object(ctx.storage, "write", side_effect=write)

        await revision.upgrade(ctx)

        assert len(downloaded_chunks[raw_key]) > 1
        assert all(len(chunk) <= chunk_size for chunk in downloaded_chunks[raw_key])
        assert len(uploaded_chunks) > 1
        assert all(len(chunk) <= chunk_size for chunk in uploaded_chunks)
