"""Tests for task-backed index creation."""

import gzip
from pathlib import Path

from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.index_sqlite import (
    COMPRESSED_INDEX_SQLITE_FILE_NAME,
    INDEX_SQLITE_FILE_NAME,
    connect_index_sqlite,
    isolates_table,
    metadata_table,
    otus_table,
    reference_table,
    sequences_table,
)
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
            "created_at": static_time.datetime,
            "data_type": "genome",
            "name": "Test Reference",
            "organism": "virus",
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


async def test_create_index_task_writes_only_compressed_sqlite_and_finalizes(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
    test_otu: dict,
    test_sequence: dict,
    tmp_path: Path,
):
    """The inactive task writes compressed SQLite and marks the index ready."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    await (await CreateIndexTask.from_task_id(data_layer, task_id)).run()

    key = compose_index_file_key("task_index", COMPRESSED_INDEX_SQLITE_FILE_NAME)

    keys = [info.key async for info in memory_storage.list("indexes/task_index/")]
    assert keys == [key]

    chunks = [chunk async for chunk in memory_storage.read(key)]
    sqlite_bytes = gzip.decompress(b"".join(chunks))
    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME
    sqlite_path.write_bytes(sqlite_bytes)

    with connect_index_sqlite(sqlite_path) as connection:
        metadata_rows = dict(connection.execute(select(metadata_table)).all())
        reference_row = connection.execute(select(reference_table)).mappings().one()
        otu_row = connection.execute(select(otus_table)).mappings().one()
        isolate_row = connection.execute(select(isolates_table)).mappings().one()
        sequence_row = connection.execute(select(sequences_table)).mappings().one()

    assert metadata_rows["format"] == "virtool-index-sqlite"
    assert metadata_rows["format_version"] == "1"
    assert reference_row["id"] == "hxn167"
    assert reference_row["data_type"] == "genome"
    assert reference_row["name"] == "Test Reference"
    assert reference_row["organism"] == "virus"
    assert otu_row["id"] == test_otu["_id"]
    assert otu_row["version"] == manifest[test_otu["_id"]]
    assert isolate_row["id"] == test_otu["isolates"][0]["id"]
    assert sequence_row["id"] == test_sequence["_id"]
    assert sequence_row["sequence"] == test_sequence["sequence"]
    assert len(b"".join(chunks)) < len(sqlite_bytes)

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
    assert rows[0].name == COMPRESSED_INDEX_SQLITE_FILE_NAME
    assert rows[0].type == "sqlite"
    assert rows[0].size == len(b"".join(chunks))

    index = await mongo.indexes.find_one("task_index")
    assert index["ready"] is True

    response = await data_layer.index.get("task_index")
    assert response.ready is True

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
    """An existing SQLite file row is updated instead of duplicated."""
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
                name=COMPRESSED_INDEX_SQLITE_FILE_NAME,
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
    assert rows[0].name == COMPRESSED_INDEX_SQLITE_FILE_NAME
    assert rows[0].type == "sqlite"
    assert rows[0].size > 1

    assert (
        await memory_storage.size(
            compose_index_file_key("task_index", COMPRESSED_INDEX_SQLITE_FILE_NAME)
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


async def test_create_index_task_finalization_failure_cleans_up_sqlite_artifact(
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
    """A failure after artifact upload removes the stored SQLite file and row."""
    manifest = await _insert_indexed_otu(mongo, test_otu, test_sequence)
    task_id = await _create_task_backed_index(
        data_layer,
        fake,
        manifest,
        mongo,
        static_time,
    )

    async def update_last_indexed_versions(*_args):
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
