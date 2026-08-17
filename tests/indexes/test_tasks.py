"""Tests for task-backed index creation."""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import get_ident

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.indexes.data
import virtool.indexes.db
from virtool.data.errors import ResourceConflictError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.tasks import CreateIndexTask
from virtool.otus.sql import SQLOTU
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_GZIP_FILE_NAME,
    SQLiteReference,
    decompress_sqlite_reference,
)
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.keys import mint_storage_key
from virtool.storage.protocol import StorageBackend
from virtool.tasks.sql import SQLTask
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestCreateIndexTask:
    """Tests for creating and finalizing task-backed indexes."""

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        static_time: StaticTime,
    ) -> None:
        self._fake = fake
        self.data_layer = data_layer
        self.memory_storage = memory_storage
        self.pg = pg
        self.static_time = static_time
        self.user = await fake.users.create()
        self.reference = await fake.references.create(user=self.user)

    @pytest.fixture
    async def task_id(self) -> int:
        self.otu = await self._fake.otus.create(self.reference.id, self.user)
        self.manifest = {self.otu.id: self.otu.version}
        return await self._create_task_backed_index(self.manifest)

    async def _create_task_backed_index(self, manifest: dict[str, int]) -> int:
        """Seed an index backed by a ``CreateIndexTask`` and return the task's id.

        The faker creates the task, so the id it was given is read back off the index.
        """
        index = await self._fake.indexes.create(
            self.reference,
            self.user,
            manifest=manifest,
            version=0,
        )

        self.index_id = index.id

        async with AsyncSession(self.pg) as session:
            task_id = await session.scalar(
                select(SQLIndex.task_id).where(SQLIndex.id == index.id),
            )

        return task_id

    async def reference_file_keys(self) -> dict[str, str]:
        """Return storage keys keyed by reference export filename."""
        async with AsyncSession(self.pg) as session:
            rows = (
                await session.execute(
                    select(SQLIndexFile.name, SQLIndexFile.storage_key).where(
                        SQLIndexFile.index_id == self.index_id,
                    ),
                )
            ).all()

        return dict(rows)

    @staticmethod
    def _assert_temp_path_empty(temp_path: Path) -> None:
        assert list(temp_path.iterdir()) == []

    @staticmethod
    def _use_temp_path(mocker: MockerFixture, temp_path: Path) -> None:
        mocker.patch(
            "virtool.indexes.data.TemporaryDirectory",
            side_effect=lambda: TemporaryDirectory(dir=temp_path),
        )

    async def test_writes_compressed_sqlite_reference_and_finalizes(
        self,
        task_id: int,
        tmp_path: Path,
    ) -> None:
        """The task publishes only a valid gzip-compressed SQLite reference."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        file_keys = await self.reference_file_keys()
        gzip_key = file_keys[REFERENCE_SQLITE_GZIP_FILE_NAME]

        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert set(keys) == set(file_keys.values())

        compressed = b"".join(
            [chunk async for chunk in self.memory_storage.read(gzip_key)],
        )
        download, size = await self.data_layer.index.get_index_file(
            self.index_id,
            REFERENCE_SQLITE_GZIP_FILE_NAME,
        )

        assert b"".join([chunk async for chunk in download]) == compressed
        assert size == len(compressed)

        gzip_path = tmp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        gzip_path.write_bytes(compressed)
        await decompress_sqlite_reference(gzip_path, sqlite_path)
        sqlite_reference = SQLiteReference.load(sqlite_path)

        await sqlite_reference.validate()

        sqlite_metadata = await sqlite_reference.get_metadata()
        sqlite_otus = [otu async for otu in sqlite_reference.iter_otus()]

        assert sqlite_metadata == {
            "id": str(self.reference.id),
            "created_at": self.reference.created_at.replace(tzinfo=UTC)
            .isoformat()
            .replace("+00:00", "Z"),
            "data_type": "genome",
            "name": self.reference.name,
            "organism": self.reference.organism,
        }
        assert sqlite_otus[0]["id"] == self.otu.id
        assert sqlite_otus[0]["version"] == self.manifest[self.otu.id]
        assert sqlite_otus[0]["isolates"][0]["id"] == self.otu.isolates[0].id
        assert {
            sequence["id"]: sequence["sequence"]
            for sequence in sqlite_otus[0]["isolates"][0]["sequences"]
        } == {
            sequence.id: sequence.sequence
            for sequence in self.otu.isolates[0].sequences
        }
        assert len(compressed) < sqlite_path.stat().st_size

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        rows_by_name = {row.name: row for row in rows}

        assert set(rows_by_name) == {REFERENCE_SQLITE_GZIP_FILE_NAME}
        assert rows_by_name[REFERENCE_SQLITE_GZIP_FILE_NAME].type == "sqlite"
        assert rows_by_name[REFERENCE_SQLITE_GZIP_FILE_NAME].size == len(compressed)

        async with AsyncSession(self.pg) as session:
            index_row = await session.scalar(
                select(SQLIndex).where(SQLIndex.id == self.index_id),
            )

        assert index_row.ready is True

        response = await self.data_layer.index.get(self.index_id)
        assert response.ready is True

        async with AsyncSession(self.pg) as session:
            otu_row = await session.scalar(
                select(SQLOTU).where(SQLOTU.id == self.otu.id),
            )

        assert otu_row.last_indexed_version == self.manifest[self.otu.id]

    async def test_marks_task_complete(self) -> None:
        """A successful build completes its task without error and readies the index."""
        otu = await self._fake.otus.create(self.reference.id, self.user)
        manifest = {otu.id: otu.version}
        task_id = await self._create_task_backed_index(manifest)

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)

        assert task.complete is True
        assert task.error is None
        assert (await self.data_layer.index.get(self.index_id)).ready is True

    async def test_streams_patched_otus_directly_to_sqlite_create(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """Patched OTUs are not materialized before SQLite creation starts."""
        original_iter_patched_otus = virtool.indexes.db.iter_patched_otus
        original_create = SQLiteReference.create
        create_started = False
        produced_count = 0

        async def iter_patched_otus(*args: object, **kwargs: object):
            nonlocal produced_count

            async for otu in original_iter_patched_otus(*args, **kwargs):
                assert create_started
                produced_count += 1
                yield otu

        async def create(
            path: Path,
            reference: dict,
            otus: AsyncIterator[dict],
        ) -> SQLiteReference:
            nonlocal create_started
            assert produced_count == 0
            create_started = True
            return await original_create(path, reference, otus)

        mocker.patch(
            "virtool.indexes.db.iter_patched_otus",
            side_effect=iter_patched_otus,
        )
        mocker.patch.object(SQLiteReference, "create", side_effect=create)

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        assert create_started is True
        assert produced_count == len(self.manifest)

    async def test_compresses_off_loop_and_uploads_multiple_chunks(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """Compression is threaded and the completed gzip is streamed to storage."""
        event_loop_thread_id = get_ident()
        compression_thread_ids = []
        uploaded_chunks = []
        upload_chunk_size = 64
        original_compress = virtool.indexes.data.compress_file_with_gzip
        original_write = self.memory_storage.write

        def compress(source_path: Path, target_path: Path) -> None:
            compression_thread_ids.append(get_ident())
            original_compress(source_path, target_path)

        async def write(key: str, data: AsyncIterator[bytes]) -> int:
            async def capture_chunks():
                async for chunk in data:
                    uploaded_chunks.append(chunk)
                    yield chunk

            return await original_write(key, capture_chunks())

        mocker.patch("virtool.storage.file.STORAGE_CHUNK_SIZE", upload_chunk_size)
        mocker.patch(
            "virtool.indexes.data.compress_file_with_gzip",
            side_effect=compress,
        )
        mocker.patch.object(self.memory_storage, "write", side_effect=write)

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        assert len(compression_thread_ids) == 1
        assert compression_thread_ids[0] != event_loop_thread_id
        assert len(uploaded_chunks) > 1
        assert all(len(chunk) <= upload_chunk_size for chunk in uploaded_chunks)
        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert set(keys) == set((await self.reference_file_keys()).values())

    async def test_runs_with_stringified_integer_index_id(self, task_id: int) -> None:
        """A task whose context stores the index id as a stringified integer still runs.

        A task created just before the integer-id cutover carries ``str(index.id)`` in
        its context; ``generate_task_index`` must resolve that digit string for one
        release so the in-flight build finalizes instead of failing.
        """
        async with AsyncSession(self.pg) as session:
            await session.execute(
                update(SQLTask)
                .where(SQLTask.id == task_id)
                .values(context={"index_id": str(self.index_id)}),
            )
            await session.commit()

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)

        assert task.complete is True
        assert task.error is None
        assert (await self.data_layer.index.get(self.index_id)).ready is True

    async def test_updates_existing_gzip_index_file_row(self, task_id: int) -> None:
        """A successful retry replaces an existing gzip artifact.

        Keys are minted per write, so the rebuild writes a new object rather than
        overwriting the old one. Superseded objects are deleted only after success.
        """
        superseded_key = mint_storage_key("indexes", self.index_id)

        async def _stream():
            yield b"stale"

        await self.memory_storage.write(superseded_key, _stream())

        async with AsyncSession(self.pg) as session:
            session.add(
                SQLIndexFile(
                    index=str(self.index_id),
                    index_id=self.index_id,
                    name=REFERENCE_SQLITE_GZIP_FILE_NAME,
                    size=5,
                    storage_key=superseded_key,
                    type="sqlite",
                ),
            )
            await session.commit()

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        rows_by_name = {row.name: row for row in rows}

        assert set(rows_by_name) == {REFERENCE_SQLITE_GZIP_FILE_NAME}
        row = rows_by_name[REFERENCE_SQLITE_GZIP_FILE_NAME]
        assert row.type == "sqlite"
        assert row.size > 1
        assert row.storage_key != superseded_key
        assert await self.memory_storage.size(row.storage_key) == row.size

        with pytest.raises(StorageKeyNotFoundError):
            await self.memory_storage.size(superseded_key)

    async def test_rejects_regenerating_ready_index(
        self,
        task_id: int,
    ) -> None:
        """A completed task-backed index cannot be regenerated."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        keys = await self.reference_file_keys()
        artifacts = {
            file_name: b"".join(
                [chunk async for chunk in self.memory_storage.read(key)],
            )
            for file_name, key in keys.items()
        }

        with pytest.raises(ResourceConflictError, match="already ready"):
            await self.data_layer.index.generate_task_index(self.index_id)

        for file_name, key in keys.items():
            assert (
                b"".join(
                    [chunk async for chunk in self.memory_storage.read(key)],
                )
                == artifacts[file_name]
            )

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert {row.name for row in rows} == set(keys)

    async def test_failure_leaves_index_unready(
        self,
        mocker: MockerFixture,
    ) -> None:
        """A failed task-backed build leaves the index unready."""
        task_id = await self._create_task_backed_index({"failing_otu": 1})
        failure_message = "failed to build reference"

        async def patch_to_version(*_args: object):
            raise RuntimeError(failure_message)

        mocker.patch(
            "virtool.history.db.patch_to_version",
            side_effect=patch_to_version,
        )

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)
        assert task.complete is False
        assert "failed to build reference" in task.error

        index = await self.data_layer.index.get(self.index_id)
        assert index.ready is False

        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert keys == []

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []

    async def test_validation_failure_removes_temporary_files(
        self,
        mocker: MockerFixture,
        tmp_path: Path,
    ) -> None:
        """A validation failure removes the raw SQLite scratch file."""
        await self._create_task_backed_index({})
        self._use_temp_path(mocker, tmp_path)
        failure_message = "failed to validate sqlite export"
        mocker.patch.object(
            SQLiteReference,
            "validate",
            side_effect=RuntimeError(failure_message),
        )

        with pytest.raises(RuntimeError, match=failure_message):
            await self.data_layer.index.generate_task_index(self.index_id)

        self._assert_temp_path_empty(tmp_path)
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == []
        assert (await self.data_layer.index.get(self.index_id)).ready is False

    async def test_compression_failure_removes_temporary_files(
        self,
        mocker: MockerFixture,
        tmp_path: Path,
    ) -> None:
        """A compression failure removes raw and partial gzip scratch files."""
        await self._create_task_backed_index({})
        self._use_temp_path(mocker, tmp_path)
        failure_message = "failed to compress sqlite export"

        def fail_compression(_source_path: Path, target_path: Path) -> None:
            target_path.write_bytes(b"partial gzip")
            raise RuntimeError(failure_message)

        mocker.patch(
            "virtool.indexes.data.compress_file_with_gzip",
            side_effect=fail_compression,
        )

        with pytest.raises(RuntimeError, match=failure_message):
            await self.data_layer.index.generate_task_index(self.index_id)

        self._assert_temp_path_empty(tmp_path)
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == []
        assert (await self.data_layer.index.get(self.index_id)).ready is False

    async def test_cancellation_removes_temporary_files(
        self,
        mocker: MockerFixture,
        tmp_path: Path,
    ) -> None:
        """Cancellation stops patch producers and removes candidate state."""
        manifest = {"pending_otu_a": 1, "pending_otu_b": 2, "pending_otu_c": 3}
        await self._create_task_backed_index(manifest)
        self._use_temp_path(mocker, tmp_path)
        all_started = asyncio.Event()
        started = []
        cancelled = []

        async def patch_to_version(_pg: object, otu_id: str, _version: int):
            started.append(otu_id)

            if len(started) == len(manifest):
                all_started.set()

            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.append(otu_id)
                raise

        mocker.patch(
            "virtool.history.db.patch_to_version",
            side_effect=patch_to_version,
        )

        build = asyncio.create_task(
            self.data_layer.index.generate_task_index(self.index_id),
        )
        await asyncio.wait_for(all_started.wait(), timeout=5)
        build.cancel()

        with pytest.raises(asyncio.CancelledError):
            await build

        assert sorted(cancelled) == sorted(manifest)
        self._assert_temp_path_empty(tmp_path)
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == []
        assert await self.reference_file_keys() == {}
        assert (await self.data_layer.index.get(self.index_id)).ready is False

    async def test_sqlite_upload_failure_cleans_up_artifact(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A failed gzip SQLite upload leaves no object or file row."""
        failure_message = "failed to upload sqlite export"

        async def fail_sqlite_upload(
            _key: str,
            _data: AsyncIterator[bytes],
        ) -> int:
            raise RuntimeError(failure_message)

        mocker.patch.object(
            self.memory_storage,
            "write",
            side_effect=fail_sqlite_upload,
        )

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)
        assert task.complete is False
        assert failure_message in task.error
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == []

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []
        assert (await self.data_layer.index.get(self.index_id)).ready is False

    async def test_finalization_failure_cleans_up_artifact(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A finalization failure removes the candidate object and file row."""
        failure_message = "failed to finalize index"

        async def update_last_indexed_versions(*_args: object):
            async with AsyncSession(self.pg) as session:
                row = (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                ).scalar_one_or_none()

            assert row is None
            raise RuntimeError(failure_message)

        mocker.patch(
            "virtool.indexes.data.update_last_indexed_versions",
            side_effect=update_last_indexed_versions,
        )

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)
        assert task.complete is False
        assert "failed to finalize index" in task.error

        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert keys == []

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index_id=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []

        index = await self.data_layer.index.get(self.index_id)
        assert index.ready is False

    async def test_failed_replacement_preserves_existing_artifact_and_retries(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """Failed finalization preserves the prior row and permits a clean retry."""
        superseded_key = mint_storage_key("indexes", self.index_id)
        existing_payload = b"existing gzip"

        async def stream():
            yield existing_payload

        await self.memory_storage.write(superseded_key, stream())

        async with AsyncSession(self.pg) as session:
            session.add(
                SQLIndexFile(
                    index=str(self.index_id),
                    index_id=self.index_id,
                    name=REFERENCE_SQLITE_GZIP_FILE_NAME,
                    size=len(existing_payload),
                    storage_key=superseded_key,
                    type="sqlite",
                ),
            )
            await session.commit()

        failure_message = "failed to finalize replacement"
        finalization = mocker.patch(
            "virtool.indexes.data.update_last_indexed_versions",
            side_effect=RuntimeError(failure_message),
        )

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        assert await self.reference_file_keys() == {
            REFERENCE_SQLITE_GZIP_FILE_NAME: superseded_key,
        }
        assert await self.memory_storage.size(superseded_key) == len(existing_payload)
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == [superseded_key]
        assert (await self.data_layer.index.get(self.index_id)).ready is False

        mocker.stop(finalization)
        await self.data_layer.index.generate_task_index(self.index_id)

        replacement_key = (await self.reference_file_keys())[
            REFERENCE_SQLITE_GZIP_FILE_NAME
        ]
        assert replacement_key != superseded_key
        assert (await self.data_layer.index.get(self.index_id)).ready is True

        with pytest.raises(StorageKeyNotFoundError):
            await self.memory_storage.size(superseded_key)
