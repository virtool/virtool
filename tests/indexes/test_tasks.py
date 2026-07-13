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
from virtool.references.sql import SQLReference
from virtool.storage.protocol import StorageBackend
from virtool.workflow.pytest_plugin.utils import StaticTime


async def _create_task_backed_index(
    data_layer: DataLayer,
    fake: DataFaker,
    manifest: dict[str, int],
    mongo: Mongo,
    static_time: StaticTime,
    reference_id: int | str = "hxn167",
) -> int:
    user = await fake.users.create()

    task = await data_layer.tasks.create(CreateIndexTask, {"index_id": "task_index"})

    if not await mongo.references.count_documents({"_id": "hxn167"}):
        await fake.references.create(
            user=user,
            id_="hxn167",
            name="Test Reference",
            organism="virus",
        )

    await mongo.indexes.insert_one(
        {
            "_id": "task_index",
            "created_at": static_time.datetime,
            "has_files": True,
            "job": None,
            "manifest": manifest,
            "ready": False,
            "reference": {"id": reference_id},
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


async def test_create_index_task_writes_only_compressed_reference_json_and_finalizes(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
):
    """The inactive task writes compressed reference JSON and marks the index ready."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    key = compose_index_file_key("task_index", "reference.json.gz")

    keys = [info.key async for info in memory_storage.list("indexes/task_index/")]
    assert keys == [key]

    compressed = b"".join([chunk async for chunk in memory_storage.read(key)])
    decompressed = gzip.decompress(compressed)
    reference_json = json.loads(decompressed)

    assert reference_json["_id"] == "hxn167"
    assert reference_json["data_type"] == "genome"
    assert reference_json["name"] == "Test Reference"
    assert reference_json["organism"] == "virus"
    assert reference_json["otus"][0]["_id"] == test_otu["_id"]
    assert reference_json["otus"][0]["version"] == manifest[test_otu["_id"]]
    assert (
        reference_json["otus"][0]["isolates"][0]["id"] == test_otu["isolates"][0]["id"]
    )
    assert (
        reference_json["otus"][0]["isolates"][0]["sequences"][0]["_id"]
        == (test_sequence["_id"])
    )
    assert (
        reference_json["otus"][0]["isolates"][0]["sequences"][0]["sequence"]
        == (test_sequence["sequence"])
    )
    assert len(compressed) < len(decompressed)

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
    assert rows[0].name == "reference.json.gz"
    assert rows[0].type == "json"
    assert rows[0].size == len(compressed)

    index = await mongo.indexes.find_one("task_index")
    assert index["ready"] is True

    response = await data_layer.index.get("task_index")
    assert response.ready is True

    otu = await mongo.otus.find_one(test_otu["_id"])
    assert otu["last_indexed_version"] == 1


async def test_create_index_task_resolves_integer_reference_id(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
):
    """A task-backed build resolves an integer embedded reference id to Mongo."""
    user = await fake.users.create()
    await fake.references.create(
        user=user,
        id_="hxn167",
        name="Test Reference",
        organism="virus",
    )

    async with AsyncSession(pg) as session:
        reference_pk = await session.scalar(
            select(SQLReference.id).where(SQLReference.legacy_id == "hxn167"),
        )

    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
        reference_pk,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    task = await data_layer.tasks.get(task_id)
    index = await mongo.indexes.find_one("task_index")

    assert task.complete is True
    assert task.error is None
    assert index["ready"] is True
    assert [info.key async for info in memory_storage.list("indexes/task_index/")] == [
        compose_index_file_key("task_index", "reference.json.gz")
    ]


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
    """An existing reference JSON file row is updated instead of duplicated."""
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
                name="reference.json.gz",
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
    assert rows[0].name == "reference.json.gz"
    assert rows[0].type == "json"
    assert rows[0].size > 1

    assert (
        await memory_storage.size(
            compose_index_file_key("task_index", "reference.json.gz")
        )
        == rows[0].size
    )


async def test_create_index_task_failure_leaves_index_unready(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
):
    """A failed task-backed build leaves the index unready."""
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

    keys = [info.key async for info in memory_storage.list("indexes/task_index/")]
    assert keys == []

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

    assert rows == []


async def test_create_index_task_finalization_failure_cleans_up_json_artifact(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
):
    """A failure after artifact upload removes the stored JSON file and row."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    async def update_last_indexed_versions(*_args):
        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLIndexFile).filter_by(index="task_index"),
                )
            ).scalar_one_or_none()

        assert row is None
        raise RuntimeError("failed to finalize index")

    mocker.patch(
        "virtool.indexes.data.update_last_indexed_versions",
        side_effect=update_last_indexed_versions,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    task = await data_layer.tasks.get(task_id)
    assert task.complete is False
    assert "failed to finalize index" in task.error

    keys = [info.key async for info in memory_storage.list("indexes/task_index/")]
    assert keys == []

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

    assert rows == []

    index = await data_layer.index.get("task_index")
    assert index.ready is False
