"""Tests for task-backed index creation."""

import gzip
import json

import pytest
from pymongo.errors import OperationFailure
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.data import update_last_indexed_versions
from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.tasks import CreateIndexTask
from virtool.indexes.utils import compose_index_file_key
from virtool.mongo.core import Mongo
from virtool.storage.protocol import StorageBackend
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestCreateIndexTask:
    """Tests for creating and finalizing task-backed indexes."""

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
    ) -> None:
        self._fake = fake
        self.data_layer = data_layer
        self.memory_storage = memory_storage
        self.mongo = mongo
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

        document = await self.mongo.indexes.find_one(index.id, ["task"])

        return document["task"]["id"]

    async def test_writes_only_compressed_reference_json_v2_and_finalizes(
        self,
        task_id: int,
    ) -> None:
        """The task writes reference JSON v2 and marks the index ready."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        key = compose_index_file_key(self.index_id, REFERENCE_JSON_V2_FILE_NAME)

        keys = [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ]
        assert keys == [key]

        compressed = b"".join(
            [chunk async for chunk in self.memory_storage.read(key)],
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

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert len(rows) == 1
        assert rows[0].name == REFERENCE_JSON_V2_FILE_NAME
        assert rows[0].type == "json"
        assert rows[0].size == len(compressed)

        index = await self.mongo.indexes.find_one(self.index_id)
        assert index["ready"] is True

        async with AsyncSession(self.pg) as session:
            index_row = await session.scalar(
                select(SQLIndex).where(SQLIndex.legacy_id == self.index_id),
            )

        assert index_row.ready is True

        response = await self.data_layer.index.get(self.index_id)
        assert response.ready is True

        otu = await self.mongo.otus.find_one(self.otu.id)
        assert otu["last_indexed_version"] == self.manifest[self.otu.id]

    async def test_marks_task_complete(self) -> None:
        """A successful build completes its task without error and readies the index."""
        otu = await self._fake.otus.create(self.reference.id, self.user)
        manifest = {otu.id: otu.version}
        task_id = await self._create_task_backed_index(manifest)

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)
        index = await self.mongo.indexes.find_one(self.index_id)

        assert task.complete is True
        assert task.error is None
        assert index["ready"] is True
        assert [
            info.key
            async for info in self.memory_storage.list(f"indexes/{self.index_id}/")
        ] == [compose_index_file_key(self.index_id, REFERENCE_JSON_V2_FILE_NAME)]

    async def test_updates_existing_index_file_row(self, task_id: int) -> None:
        """An existing reference JSON file row is updated instead of duplicated."""
        async with AsyncSession(self.pg) as session:
            index_pk = await session.scalar(
                select(SQLIndex.id).where(SQLIndex.legacy_id == self.index_id),
            )
            session.add(
                SQLIndexFile(
                    index=self.index_id,
                    index_id=index_pk,
                    name=REFERENCE_JSON_V2_FILE_NAME,
                    size=1,
                    type="json",
                ),
            )
            await session.commit()

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert len(rows) == 1
        assert rows[0].name == REFERENCE_JSON_V2_FILE_NAME
        assert rows[0].type == "json"
        assert rows[0].size > 1

        assert (
            await self.memory_storage.size(
                compose_index_file_key(self.index_id, REFERENCE_JSON_V2_FILE_NAME),
            )
            == rows[0].size
        )

    async def test_rejects_regenerating_ready_index(self, task_id: int) -> None:
        """A completed task-backed index cannot be regenerated."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        key = compose_index_file_key(self.index_id, REFERENCE_JSON_V2_FILE_NAME)
        artifact = b"".join(
            [chunk async for chunk in self.memory_storage.read(key)],
        )

        with pytest.raises(ResourceConflictError, match="already ready"):
            await self.data_layer.index.generate_task_index(self.index_id)

        assert (
            b"".join(
                [chunk async for chunk in self.memory_storage.read(key)],
            )
            == artifact
        )

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert len(rows) == 1
        assert rows[0].name == REFERENCE_JSON_V2_FILE_NAME

    async def test_retries_transient_finalization_failure(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A transient Mongo transaction error retries database finalization."""
        attempts = 0

        async def fail_once(*args: object) -> None:
            nonlocal attempts
            attempts += 1

            if attempts == 1:
                message = "transient transaction failure"
                raise OperationFailure(
                    message,
                    details={"errorLabels": ["TransientTransactionError"]},
                )

            await update_last_indexed_versions(*args)

        mocker.patch(
            "virtool.indexes.data.update_last_indexed_versions",
            side_effect=fail_once,
        )

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        expected_attempts = 2
        assert attempts == expected_attempts
        assert (await self.data_layer.tasks.get(task_id)).complete is True
        assert (await self.data_layer.index.get(self.index_id)).ready is True
        assert (
            await self.memory_storage.size(
                compose_index_file_key(self.index_id, REFERENCE_JSON_V2_FILE_NAME),
            )
            > 0
        )

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
                        select(SQLIndexFile).filter_by(index=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []

    async def test_finalization_failure_cleans_up_json_artifact(
        self,
        mocker: MockerFixture,
        task_id: int,
    ) -> None:
        """A failure after artifact upload removes the stored JSON file and row."""
        failure_message = "failed to finalize index"

        async def update_last_indexed_versions(*_args: object):
            async with AsyncSession(self.pg) as session:
                row = (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index=self.index_id),
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
                        select(SQLIndexFile).filter_by(index=self.index_id),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []

        index = await self.data_layer.index.get(self.index_id)
        assert index.ready is False
