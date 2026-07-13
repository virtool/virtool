import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.indexes.db
from tests.fixtures.client import ClientSpawner
from virtool.history.sql import SQLLegacyHistory
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
    pg: AsyncEngine,
    fake,
    snapshot: SnapshotAssertion,
    static_time,
):
    """The new index embeds the integer ``legacy_references`` primary key of its
    reference rather than the legacy Mongo string id.
    """
    user = await fake.users.create()

    await fake.references.create(user=user, id_="foo")

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    created = await virtool.indexes.db.create(
        mongo,
        pg,
        "foo",
        "test",
        "bar",
        index_id=index_id,
    )

    assert created["created_at"] == static_time.datetime
    assert created == snapshot


async def test_create_assigns_index_in_postgres(
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """Building an index assigns previously-unbuilt changes for the reference to the
    new index in ``legacy_history``, leaving other references and already-built
    changes untouched.
    """
    user = await fake.users.create()
    built_ref = await fake.references.create(user=user, id_="built_ref")
    other_ref = await fake.references.create(user=user, id_="other_ref")

    await mongo.indexes.insert_one(
        {
            "_id": "prior_index",
            "reference": {"id": built_ref.id},
            "version": 0,
            "ready": True,
        },
    )

    def legacy_row(
        legacy_id: str, reference_id: int, index: str | None
    ) -> SQLLegacyHistory:
        return SQLLegacyHistory(
            legacy_id=legacy_id,
            created_at=static_time.datetime,
            description="",
            method_name="create_otu",
            user_id=user.id,
            otu=legacy_id,
            otu_name=legacy_id,
            otu_version="0",
            reference_id=reference_id,
            index=index,
            index_version="0" if index else None,
        )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                legacy_row("ref_unbuilt", built_ref.id, None),
                legacy_row("ref_already_built", built_ref.id, "prior_index"),
                legacy_row("other_ref_unbuilt", other_ref.id, None),
            ],
        )
        await session.commit()

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    await virtool.indexes.db.create(
        mongo,
        pg,
        "built_ref",
        user.id,
        1,
        index_id="new_index",
    )

    async with AsyncSession(pg) as session:
        rows = {
            row.legacy_id: (row.index, row.index_version)
            for row in (await session.execute(select(SQLLegacyHistory))).scalars()
        }

    assert rows["ref_unbuilt"] == ("new_index", "1")
    assert rows["ref_already_built"] == ("prior_index", "0")
    assert rows["other_ref_unbuilt"] == (None, None)


async def test_create_rolls_back_both_stores_on_failure(
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """A failure during the index build rolls back the Mongo index insert issued
    inside the transaction, leaving neither store with the index assignment.
    """
    user = await fake.users.create()

    built_ref = await fake.references.create(user=user, id_="built_ref")

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacyHistory(
                legacy_id="ref_unbuilt",
                created_at=static_time.datetime,
                description="",
                method_name="create_otu",
                user_id=user.id,
                otu="ref_unbuilt",
                otu_name="ref_unbuilt",
                otu_version="0",
                reference_id=built_ref.id,
                index=None,
                index_version=None,
            ),
        )
        await session.commit()

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))
    mocker.patch(
        "virtool.indexes.db.update",
        side_effect=RuntimeError("postgres write failed"),
    )

    with pytest.raises(RuntimeError, match="postgres write failed"):
        await virtool.indexes.db.create(
            mongo,
            pg,
            "built_ref",
            user.id,
            1,
            index_id="new_index",
        )

    assert await mongo.indexes.find_one("new_index") is None

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "ref_unbuilt",
                ),
            )
        ).scalar_one()

    assert row.index is None
    assert row.index_version is None


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_current_id_and_version(
    exists, has_ref, test_indexes, mongo, pg: AsyncEngine
):
    if not exists:
        test_indexes = [dict(i, ready=False, has_files=False) for i in test_indexes]

    await mongo.indexes.insert_many(test_indexes, session=None)

    ref_id = "hxn167" if has_ref else "foobar"

    index_id, index_version = await get_current_id_and_version(mongo, pg, ref_id)

    if has_ref and exists:
        assert index_id == "ptlrcefm"
        assert index_version == 3

    else:
        assert index_id is None
        assert index_version == -1


@pytest.mark.parametrize("empty", [False, True])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_next_version(empty, has_ref, test_indexes, mongo, pg: AsyncEngine):
    if not empty:
        await mongo.indexes.insert_many(test_indexes, session=None)

    expected = 4

    if empty or not has_ref:
        expected = 0

    assert (
        await get_next_version(mongo, pg, "hxn167" if has_ref else "foobar") == expected
    )


async def test_reads_tolerate_integer_embedded_reference_id(
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
):
    """``get_current_id_and_version`` and ``get_next_version`` resolve the legacy
    string ref id and match an index whose embedded ``reference.id`` is the integer
    ``legacy_references`` primary key.
    """
    user = await fake.users.create()

    reference = await fake.references.create(user=user, id_="legacy_ref")

    await mongo.indexes.insert_one(
        {
            "_id": "built_index",
            "reference": {"id": reference.id},
            "version": 0,
            "ready": True,
        },
    )

    index_id, index_version = await get_current_id_and_version(mongo, pg, "legacy_ref")

    assert index_id == "built_index"
    assert index_version == 0
    assert await get_next_version(mongo, pg, "legacy_ref") == 1


async def test_iter_patched_otus_starts_when_consumed(
    mocker: MockerFixture,
    mongo: Mongo,
):
    async def patch_to_version(_mongo, _pg, otu_id, version):
        return None, {"_id": otu_id, "version": version}

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

        return None, {"_id": otu_id, "version": version}

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

        return None, {"_id": otu_id, "version": version}

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

        return None, {"_id": otu_id, "version": version}

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
                    name="reference.json.gz",
                ),
            )
        ).scalar_one_or_none() is None

    async with AsyncSession(pg) as session:
        assert await upsert_index_file(
            session,
            "foo",
            "json",
            "reference.json.gz",
            9000,
        ) == {
            "id": 1,
            "index": "foo",
            "name": "reference.json.gz",
            "size": 9000,
            "type": "json",
        }
        await session.commit()

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLIndexFile).filter_by(
                    index="foo",
                    name="reference.json.gz",
                ),
            )
        ).scalar_one()

    assert row.to_dict() == {
        "id": 1,
        "index": "foo",
        "name": "reference.json.gz",
        "size": 9000,
        "type": "json",
    }


async def test_upsert_index_file_updates_existing_row(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                index="foo",
                name="reference.json.gz",
                size=1,
                type="json",
            ),
        )
        await session.commit()

    async with AsyncSession(pg) as session:
        assert await upsert_index_file(
            session,
            "foo",
            "json",
            "reference.json.gz",
            9000,
        ) == {
            "id": 1,
            "index": "foo",
            "name": "reference.json.gz",
            "size": 9000,
            "type": "json",
        }
        await session.commit()

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
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    test_otu,
):
    await spawn_client(authenticated=True)
    test_otu["version"] = 1

    await mongo.otus.insert_one(test_otu)

    async with mongo.create_session() as session:
        await update_last_indexed_versions(mongo, pg, "hxn167", session)

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
