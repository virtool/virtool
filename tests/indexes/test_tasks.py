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
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.tasks import CreateIndexTask
from virtool.indexes.utils import compose_index_file_key
from virtool.mongo.core import Mongo
from virtool.otus.db import bulk_insert_otu_rows, bulk_insert_sequence_rows
from virtool.storage.protocol import StorageBackend
from virtool.workflow.pytest_plugin.utils import StaticTime


async def _insert_indexed_otu(
    mongo: Mongo,
    pg: AsyncEngine,
    reference_id: int,
    test_otu: dict,
    test_sequence: dict,
) -> dict[str, int]:
    otu = {
        **test_otu,
        "last_indexed_version": 0,
        "reference": {"id": reference_id},
        "verified": True,
        "version": 1,
    }

    sequence = {
        **test_sequence,
        "reference": otu["reference"],
        "otu_id": otu["_id"],
    }

    await mongo.otus.insert_one(otu)
    await mongo.sequences.insert_one(sequence)

    async with AsyncSession(pg) as session:
        await bulk_insert_otu_rows(session, [otu], reference_id)
        await bulk_insert_sequence_rows(session, [sequence])
        await session.commit()

    return {otu["_id"]: otu["version"]}


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
        test_otu: dict,
        test_sequence: dict,
    ) -> None:
        self.data_layer = data_layer
        self.memory_storage = memory_storage
        self.mongo = mongo
        self.pg = pg
        self.static_time = static_time
        self.test_otu = test_otu
        self.test_sequence = test_sequence
        self.user = await fake.users.create()
        self.reference = await fake.references.create(user=self.user)

    @pytest.fixture
    async def task_id(self) -> int:
        self.manifest = await _insert_indexed_otu(
            self.mongo,
            self.pg,
            self.reference.id,
            self.test_otu,
            self.test_sequence,
        )
        return await self._create_task_backed_index(
            self.manifest,
            self.reference.id,
        )

    async def _create_task_backed_index(
        self,
        manifest: dict[str, int],
        reference_id: int | str,
    ) -> int:
        task = await self.data_layer.tasks.create(
            CreateIndexTask,
            {"index_id": "task_index"},
        )

        await self.mongo.indexes.insert_one(
            {
                "_id": "task_index",
                "created_at": self.static_time.datetime,
                "has_files": True,
                "job": None,
                "manifest": manifest,
                "ready": False,
                "reference": {"id": reference_id},
                "task": {"id": task.id},
                "user": {"id": self.user.id},
                "version": 0,
            },
        )

        return task.id

    async def test_writes_only_compressed_reference_json_v2_and_finalizes(
        self,
        task_id: int,
    ) -> None:
        """The task writes reference JSON v2 and marks the index ready."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        key = compose_index_file_key("task_index", REFERENCE_JSON_V2_FILE_NAME)

        keys = [
            info.key async for info in self.memory_storage.list("indexes/task_index/")
        ]
        assert keys == [key]

        compressed = b"".join(
            [chunk async for chunk in self.memory_storage.read(key)],
        )
        download, size = await self.data_layer.index.get_index_file(
            "task_index",
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
        assert reference_json["otus"][0]["_id"] == self.test_otu["_id"]
        assert (
            reference_json["otus"][0]["version"] == self.manifest[self.test_otu["_id"]]
        )
        assert (
            reference_json["otus"][0]["isolates"][0]["id"]
            == self.test_otu["isolates"][0]["id"]
        )
        assert (
            reference_json["otus"][0]["isolates"][0]["sequences"][0]["_id"]
            == self.test_sequence["_id"]
        )
        assert (
            reference_json["otus"][0]["isolates"][0]["sequences"][0]["sequence"]
            == self.test_sequence["sequence"]
        )
        assert len(compressed) < len(decompressed)

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index="task_index"),
                    )
                )
                .scalars()
                .all()
            )

        assert len(rows) == 1
        assert rows[0].name == REFERENCE_JSON_V2_FILE_NAME
        assert rows[0].type == "json"
        assert rows[0].size == len(compressed)

        index = await self.mongo.indexes.find_one("task_index")
        assert index["ready"] is True

        response = await self.data_layer.index.get("task_index")
        assert response.ready is True

        otu = await self.mongo.otus.find_one(self.test_otu["_id"])
        assert otu["last_indexed_version"] == 1

    async def test_resolves_integer_reference_id(self) -> None:
        """A task-backed build accepts an integer embedded reference id."""
        manifest = await _insert_indexed_otu(
            self.mongo,
            self.pg,
            self.reference.id,
            self.test_otu,
            self.test_sequence,
        )
        task_id = await self._create_task_backed_index(manifest, self.reference.id)

        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        task = await self.data_layer.tasks.get(task_id)
        index = await self.mongo.indexes.find_one("task_index")

        assert task.complete is True
        assert task.error is None
        assert index["ready"] is True
        assert [
            info.key async for info in self.memory_storage.list("indexes/task_index/")
        ] == [compose_index_file_key("task_index", REFERENCE_JSON_V2_FILE_NAME)]

    async def test_updates_existing_index_file_row(self, task_id: int) -> None:
        """An existing reference JSON file row is updated instead of duplicated."""
        async with AsyncSession(self.pg) as session:
            session.add(
                SQLIndexFile(
                    index="task_index",
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
                        select(SQLIndexFile).filter_by(index="task_index"),
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
                compose_index_file_key("task_index", REFERENCE_JSON_V2_FILE_NAME),
            )
            == rows[0].size
        )

    async def test_rejects_regenerating_ready_index(self, task_id: int) -> None:
        """A completed task-backed index cannot be regenerated."""
        await (await CreateIndexTask.from_task_id(self.data_layer, task_id)).run()

        key = compose_index_file_key("task_index", REFERENCE_JSON_V2_FILE_NAME)
        artifact = b"".join(
            [chunk async for chunk in self.memory_storage.read(key)],
        )

        with pytest.raises(ResourceConflictError, match="already ready"):
            await self.data_layer.index.generate_task_index("task_index")

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
                        select(SQLIndexFile).filter_by(index="task_index"),
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
        assert (await self.data_layer.index.get("task_index")).ready is True
        assert (
            await self.memory_storage.size(
                compose_index_file_key("task_index", REFERENCE_JSON_V2_FILE_NAME),
            )
            > 0
        )

    async def test_failure_leaves_index_unready(
        self,
        mocker: MockerFixture,
    ) -> None:
        """A failed task-backed build leaves the index unready."""
        task_id = await self._create_task_backed_index(
            {"failing_otu": 1},
            self.reference.id,
        )
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

        index = await self.data_layer.index.get("task_index")
        assert index.ready is False

        keys = [
            info.key async for info in self.memory_storage.list("indexes/task_index/")
        ]
        assert keys == []

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index="task_index"),
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
                        select(SQLIndexFile).filter_by(index="task_index"),
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
            info.key async for info in self.memory_storage.list("indexes/task_index/")
        ]
        assert keys == []

        async with AsyncSession(self.pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index="task_index"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []

        index = await self.data_layer.index.get("task_index")
        assert index.ready is False
