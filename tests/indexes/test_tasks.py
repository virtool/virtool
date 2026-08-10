"""Tests for task-backed index creation."""

import gzip
import json
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.tasks import CreateIndexTask
from virtool.otus.sql import SQLOTU
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
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
                        SQLIndexFile.name.in_(
                            (
                                REFERENCE_JSON_V2_FILE_NAME,
                                REFERENCE_SQLITE_FILE_NAME,
                            )
                        ),
                    ),
                )
            ).all()

        return dict(rows)

    async def test_writes_json_and_sqlite_reference_exports_and_finalizes(
        self,
        task_id: int,
        tmp_path: Path,
    ) -> None:
        """The task writes equivalent JSON and SQLite reference exports."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        file_keys = await self.reference_file_keys()
        json_key = file_keys[REFERENCE_JSON_V2_FILE_NAME]
        sqlite_key = file_keys[REFERENCE_SQLITE_FILE_NAME]

        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert set(keys) == set(file_keys.values())

        compressed = b"".join(
            [chunk async for chunk in self.memory_storage.read(json_key)],
        )
        download, size = await self.data_layer.index.get_index_file(
            self.index_id,
            REFERENCE_JSON_V2_FILE_NAME,
        )

        assert b"".join([chunk async for chunk in download]) == compressed
        assert size == len(compressed)

        decompressed = gzip.decompress(compressed)
        reference_json = json.loads(decompressed)

        assert reference_json["_id"] == self.reference.id
        assert reference_json["data_type"] == "genome"
        assert reference_json["name"] == self.reference.name
        assert reference_json["organism"] == self.reference.organism == ""
        assert reference_json["otus"][0]["_id"] == self.otu.id
        assert reference_json["otus"][0]["version"] == self.manifest[self.otu.id]
        assert reference_json["otus"][0]["isolates"][0]["id"] == self.otu.isolates[0].id

        json_sequences = {
            sequence["_id"]: sequence["sequence"]
            for sequence in reference_json["otus"][0]["isolates"][0]["sequences"]
        }
        assert json_sequences == {
            sequence.id: sequence.sequence
            for sequence in self.otu.isolates[0].sequences
        }
        assert len(compressed) < len(decompressed)

        sqlite_bytes = b"".join(
            [chunk async for chunk in self.memory_storage.read(sqlite_key)],
        )
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        sqlite_path.write_bytes(sqlite_bytes)
        sqlite_reference = SQLiteReference.load(sqlite_path)

        await sqlite_reference.validate()

        sqlite_metadata = await sqlite_reference.get_metadata()
        sqlite_otus = [otu async for otu in sqlite_reference.iter_otus()]

        assert sqlite_metadata == {
            "id": str(self.reference.id),
            "created_at": reference_json["created_at"],
            "data_type": reference_json["data_type"],
            "name": reference_json["name"],
            "organism": reference_json["organism"],
        }
        assert sqlite_otus[0]["id"] == reference_json["otus"][0]["_id"]
        assert sqlite_otus[0]["version"] == reference_json["otus"][0]["version"]
        assert (
            sqlite_otus[0]["isolates"][0]["id"]
            == (reference_json["otus"][0]["isolates"][0]["id"])
        )
        assert {
            sequence["id"]: sequence["sequence"]
            for sequence in sqlite_otus[0]["isolates"][0]["sequences"]
        } == json_sequences

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

        assert set(rows_by_name) == {
            REFERENCE_JSON_V2_FILE_NAME,
            REFERENCE_SQLITE_FILE_NAME,
        }
        assert rows_by_name[REFERENCE_JSON_V2_FILE_NAME].type == "json"
        assert rows_by_name[REFERENCE_JSON_V2_FILE_NAME].size == len(compressed)
        assert rows_by_name[REFERENCE_SQLITE_FILE_NAME].type == "sqlite"
        assert rows_by_name[REFERENCE_SQLITE_FILE_NAME].size == len(sqlite_bytes)

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

    async def test_updates_existing_index_file_rows(self, task_id: int) -> None:
        """Existing reference export rows are updated instead of duplicated.

        Keys are minted per write, so the rebuild writes a new object rather than
        overwriting the old ones. Superseded objects must be deleted or every retried
        build leaks two.
        """
        superseded_keys = {
            file_name: mint_storage_key("indexes", self.index_id)
            for file_name in (
                REFERENCE_JSON_V2_FILE_NAME,
                REFERENCE_SQLITE_FILE_NAME,
            )
        }

        async def _stream():
            yield b"stale"

        for key in superseded_keys.values():
            await self.memory_storage.write(key, _stream())

        async with AsyncSession(self.pg) as session:
            session.add_all(
                [
                    SQLIndexFile(
                        index=str(self.index_id),
                        index_id=self.index_id,
                        name=file_name,
                        size=5,
                        storage_key=superseded_keys[file_name],
                        type=file_type,
                    )
                    for file_name, file_type in (
                        (REFERENCE_JSON_V2_FILE_NAME, "json"),
                        (REFERENCE_SQLITE_FILE_NAME, "sqlite"),
                    )
                ],
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

        assert set(rows_by_name) == {
            REFERENCE_JSON_V2_FILE_NAME,
            REFERENCE_SQLITE_FILE_NAME,
        }
        assert rows_by_name[REFERENCE_JSON_V2_FILE_NAME].type == "json"
        assert rows_by_name[REFERENCE_JSON_V2_FILE_NAME].size > 1
        assert rows_by_name[REFERENCE_SQLITE_FILE_NAME].type == "sqlite"
        assert rows_by_name[REFERENCE_SQLITE_FILE_NAME].size > 1

        for file_name, row in rows_by_name.items():
            assert row.storage_key != superseded_keys[file_name]
            assert await self.memory_storage.size(row.storage_key) == row.size

            with pytest.raises(StorageKeyNotFoundError):
                await self.memory_storage.size(superseded_keys[file_name])

    async def test_rejects_regenerating_ready_index(self, task_id: int) -> None:
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

    async def test_sqlite_upload_failure_cleans_up_both_artifacts(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A failed SQLite upload removes the previously uploaded JSON export."""
        write = self.memory_storage.write
        failure_message = "failed to upload sqlite export"
        write_count = 0

        async def fail_sqlite_upload(key: str, data: AsyncIterator[bytes]) -> int:
            nonlocal write_count
            write_count += 1

            if write_count == 2:
                raise RuntimeError(failure_message)

            return await write(key, data)

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

    async def test_finalization_failure_cleans_up_both_artifacts(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A finalization failure removes both stored exports and file rows."""
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
