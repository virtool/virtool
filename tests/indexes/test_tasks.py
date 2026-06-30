"""Tests for task-backed index creation."""

import gzip
import json

from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.tasks import CreateIndexTask
from virtool.indexes.utils import compose_index_file_key
from virtool.mongo.core import Mongo
from virtool.storage.protocol import StorageBackend
from virtool.workflow.pytest_plugin.utils import StaticTime


async def _create_task_backed_index(
    data_layer: DataLayer,
    fake: DataFaker,
    manifest: dict[str, int],
    mongo: Mongo,
    static_time: StaticTime,
) -> int:
    user = await fake.users.create()

    task = await data_layer.tasks.create(CreateIndexTask, {"index_id": "task_index"})

    await mongo.references.insert_one(
        {
            "_id": "hxn167",
            "archived": False,
            "data_type": "genome",
            "name": "Test Reference",
        },
    )

    await mongo.indexes.insert_one(
        {
            "_id": "task_index",
            "created_at": static_time.datetime,
            "has_files": True,
            "job": None,
            "manifest": manifest,
            "ready": False,
            "reference": {"id": "hxn167"},
            "task": {"id": task.id},
            "user": {"id": user.id},
            "version": 0,
        },
    )

    return task.id


async def _insert_indexed_otu(
    mongo: Mongo,
    test_otu: dict,
    test_sequence: dict,
) -> dict[str, int]:
    otu = {
        **test_otu,
        "last_indexed_version": 0,
        "reference": {"id": "hxn167"},
        "verified": True,
        "version": 1,
    }

    await mongo.otus.insert_one(otu)

    await mongo.sequences.insert_one(
        {
            **test_sequence,
            "reference": otu["reference"],
            "otu_id": otu["_id"],
        },
    )

    return {otu["_id"]: otu["version"]}


async def test_create_index_task_writes_only_ndjson_and_finalizes(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
):
    """The inactive task writes NDJSON and marks the index ready."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    key = compose_index_file_key("task_index", "reference.ndjson.gz")

    keys = [info.key async for info in memory_storage.list("indexes/task_index/")]
    assert keys == [key]

    chunks = [chunk async for chunk in memory_storage.read(key)]
    records = [
        json.loads(line)
        for line in gzip.decompress(b"".join(chunks)).decode().splitlines()
    ]

    assert records[0] == {
        "type": "reference",
        "id": "hxn167",
        "data_type": "genome",
        "name": "Test Reference",
    }
    assert len(records) == 2
    assert records[1]["type"] == "otu"
    assert records[1]["_id"] == test_otu["_id"]
    assert (
        records[1]["isolates"][0]["sequences"][0]["sequence"]
        == test_sequence["sequence"]
    )

    async with AsyncSession(pg) as session:
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
    assert rows[0].name == "reference.ndjson.gz"
    assert rows[0].type == "ndjson"
    assert rows[0].size == len(b"".join(chunks))

    index = await mongo.indexes.find_one("task_index")
    assert index["ready"] is True

    response = await data_layer.index.get("task_index")
    assert response.build.dict() == {"progress": 100, "status": "succeeded"}

    otu = await mongo.otus.find_one(test_otu["_id"])
    assert otu["last_indexed_version"] == 1


async def test_create_index_task_updates_existing_index_file_row(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
):
    """An existing NDJSON file row is updated instead of duplicated."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                index="task_index",
                name="reference.ndjson.gz",
                size=1,
                type="json",
            ),
        )
        await session.commit()

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    async with AsyncSession(pg) as session:
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
    assert rows[0].name == "reference.ndjson.gz"
    assert rows[0].type == "ndjson"
    assert rows[0].size > 1

    assert (
        await memory_storage.size(
            compose_index_file_key("task_index", "reference.ndjson.gz")
        )
        == rows[0].size
    )


async def test_create_index_task_failure_is_visible_in_build(
    data_layer: DataLayer,
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    static_time: StaticTime,
):
    """A failed task-backed build is visible through the index build field."""
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        {"failing_otu": 1},
        mongo,
        static_time,
    )

    async def patch_to_version(*_args):
        raise RuntimeError("failed to build reference")

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    task = await data_layer.tasks.get(task_id)
    assert task.complete is False
    assert "failed to build reference" in task.error

    index = await data_layer.index.get("task_index")
    assert index.ready is False
    assert index.build.dict() == {"progress": 0, "status": "failed"}
