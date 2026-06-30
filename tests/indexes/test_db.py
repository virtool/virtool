import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.indexes.db
from tests.fixtures.client import ClientSpawner
from virtool.indexes.db import (
    attach_files,
    get_current_id_and_version,
    get_next_version,
    iter_patched_otus,
    update_last_indexed_versions,
    upsert_index_file,
)
from virtool.indexes.sql import SQLIndexFile
from virtool.mongo.core import Mongo


@pytest.mark.parametrize("index_id", [None, "abc"])
async def test_create(
    index_id: str | None,
    mocker: MockerFixture,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time,
):
    await asyncio.gather(
        mongo.references.insert_one({"_id": "foo"}),
        mongo.history.insert_one(
            {
                "_id": "abc",
                "index": {"id": "unbuilt", "version": "unbuilt"},
                "reference": {"id": "foo"},
            },
        ),
    )

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    assert (
        await virtool.indexes.db.create(
            mongo,
            "foo",
            "test",
            "bar",
            index_id=index_id,
        )
        == snapshot
    )
    assert await mongo.history.find_one("abc") == snapshot


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_current_id_and_version(exists, has_ref, test_indexes, mongo):
    if not exists:
        test_indexes = [dict(i, ready=False, has_files=False) for i in test_indexes]

    await mongo.indexes.insert_many(test_indexes, session=None)

    ref_id = "hxn167" if has_ref else "foobar"

    index_id, index_version = await get_current_id_and_version(mongo, ref_id)

    if has_ref and exists:
        assert index_id == "ptlrcefm"
        assert index_version == 3

    else:
        assert index_id is None
        assert index_version == -1


@pytest.mark.parametrize("empty", [False, True])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_next_version(empty, has_ref, test_indexes, mongo):
    if not empty:
        await mongo.indexes.insert_many(test_indexes, session=None)

    expected = 4

    if empty or not has_ref:
        expected = 0

    assert await get_next_version(mongo, "hxn167" if has_ref else "foobar") == expected


async def test_iter_patched_otus_starts_when_consumed(
    mocker: MockerFixture,
    mongo: Mongo,
):
    async def patch_to_version(_mongo, _pg, otu_id, version):
        return None, {"_id": otu_id, "version": version}, None

    m = mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    pg = mocker.Mock()
    stream = iter_patched_otus(mongo, pg, {"foo": 2, "bar": 10})

    assert m.call_count == 0

    assert await anext(stream) == {"_id": "foo", "version": 2}
    assert m.call_args_list[0] == mocker.call(mongo, pg, "foo", 2)

    assert await anext(stream) == {"_id": "bar", "version": 10}
    assert m.call_args_list[-1] == mocker.call(mongo, pg, "bar", 10)

    with pytest.raises(StopAsyncIteration):
        await anext(stream)

    assert m.call_count == 2


async def test_iter_patched_otus_preserves_order_when_patches_finish_out_of_order(
    mocker: MockerFixture,
    mongo: Mongo,
):
    gates = {
        "slow": asyncio.Event(),
        "fast": asyncio.Event(),
    }
    all_started = asyncio.Event()
    started = []

    async def patch_to_version(_mongo, _pg, otu_id, version):
        started.append(otu_id)

        if len(started) == 2:
            all_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}, None

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mongo,
        mocker.Mock(),
        {"slow": 1, "fast": 2},
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(all_started.wait(), timeout=1)

    gates["fast"].set()
    await asyncio.sleep(0)

    assert first.done() is False

    gates["slow"].set()

    assert await first == {"_id": "slow", "version": 1}
    assert await anext(stream) == {"_id": "fast", "version": 2}

    with pytest.raises(StopAsyncIteration):
        await anext(stream)


async def test_iter_patched_otus_limits_concurrent_patches(
    mocker: MockerFixture,
    mongo: Mongo,
):
    concurrency = 3
    manifest = {f"otu_{i}": i for i in range(concurrency + 1)}
    gates = {otu_id: asyncio.Event() for otu_id in manifest}
    initial_patches_started = asyncio.Event()
    next_patch_started = asyncio.Event()
    started = []

    async def patch_to_version(_mongo, _pg, otu_id, version):
        started.append(otu_id)

        if len(started) == concurrency:
            initial_patches_started.set()

        if len(started) == concurrency + 1:
            next_patch_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}, None

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mongo,
        mocker.Mock(),
        manifest,
        concurrency=concurrency,
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(initial_patches_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency)]

    gates[f"otu_{concurrency - 1}"].set()
    await asyncio.wait_for(next_patch_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency + 1)]

    gates["otu_0"].set()

    assert await first == {"_id": "otu_0", "version": 0}

    await stream.aclose()


async def test_iter_patched_otus_limits_scheduled_lookahead(
    mocker: MockerFixture,
    mongo: Mongo,
):
    concurrency = 2
    window_size = 5
    manifest = {f"otu_{i}": i for i in range(window_size + 1)}
    gates = {otu_id: asyncio.Event() for otu_id in manifest}
    initial_patches_started = asyncio.Event()
    window_started = asyncio.Event()
    beyond_window_started = asyncio.Event()
    started = []

    async def patch_to_version(_mongo, _pg, otu_id, version):
        started.append(otu_id)

        if len(started) == concurrency:
            initial_patches_started.set()

        if len(started) == window_size:
            window_started.set()

        if len(started) == window_size + 1:
            beyond_window_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}, None

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mongo,
        mocker.Mock(),
        manifest,
        concurrency=concurrency,
        window_size=window_size,
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(initial_patches_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency)]

    async def release_started_otus_until(target_count: int) -> None:
        next_to_release = 1

        while len(started) < target_count:
            for i in range(next_to_release, len(started)):
                gates[f"otu_{i}"].set()

            next_to_release = len(started)
            await asyncio.sleep(0)

    await asyncio.wait_for(release_started_otus_until(window_size), timeout=1)
    await asyncio.wait_for(window_started.wait(), timeout=1)

    for _ in range(3):
        await asyncio.sleep(0)

    assert started == [f"otu_{i}" for i in range(window_size)]
    assert beyond_window_started.is_set() is False

    gates["otu_0"].set()

    assert await first == {"_id": "otu_0", "version": 0}

    second = asyncio.create_task(anext(stream))

    await asyncio.wait_for(beyond_window_started.wait(), timeout=1)

    assert await second == {"_id": "otu_1", "version": 1}

    await stream.aclose()


async def test_upsert_index_file_creates_row(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        assert (
            await session.execute(
                select(SQLIndexFile).filter_by(
                    index="foo",
                    name="reference.ndjson.gz",
                ),
            )
        ).scalar_one_or_none() is None

    assert await upsert_index_file(
        pg,
        "foo",
        "ndjson",
        "reference.ndjson.gz",
        9000,
    ) == {
        "id": 1,
        "index": "foo",
        "name": "reference.ndjson.gz",
        "size": 9000,
        "type": "ndjson",
    }

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLIndexFile).filter_by(
                    index="foo",
                    name="reference.ndjson.gz",
                ),
            )
        ).scalar_one()

    assert row.to_dict() == {
        "id": 1,
        "index": "foo",
        "name": "reference.ndjson.gz",
        "size": 9000,
        "type": "ndjson",
    }


async def test_upsert_index_file_updates_existing_row(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                index="foo",
                name="reference.ndjson.gz",
                size=1,
                type="json",
            ),
        )
        await session.commit()

    assert await upsert_index_file(
        pg,
        "foo",
        "ndjson",
        "reference.ndjson.gz",
        9000,
    ) == {
        "id": 1,
        "index": "foo",
        "name": "reference.ndjson.gz",
        "size": 9000,
        "type": "ndjson",
    }

    async with AsyncSession(pg) as session:
        rows = (
            (
                await session.execute(
                    select(SQLIndexFile).filter_by(index="foo"),
                )
            )
            .scalars()
            .all()
        )

    assert len(rows) == 1


async def test_update_last_indexed_versions(
    mongo: Mongo,
    spawn_client: ClientSpawner,
    test_otu,
):
    await spawn_client(authenticated=True)
    test_otu["version"] = 1

    await mongo.otus.insert_one(test_otu)

    async with mongo.create_session() as session:
        await update_last_indexed_versions(mongo, "hxn167", session)

    document = await mongo.otus.find_one({"reference.id": "hxn167"})

    assert document["last_indexed_version"] == document["version"]


async def test_attach_files(snapshot, pg: AsyncEngine):
    index_1 = SQLIndexFile(
        id=1,
        name="reference.fa.gz",
        index="foo",
        type="fasta",
        size=1234567,
    )
    index_2 = SQLIndexFile(
        id=2,
        name="reference.json.gz",
        index="foo",
        type="json",
        size=1234567,
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2])
        await session.commit()

    document = {"_id": "foo", "reference": {"id": "bar"}}

    assert (
        await attach_files(pg, "https://virtool.example.com/api", document) == snapshot
    )
