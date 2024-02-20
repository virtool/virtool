import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.indexes.db
from aiohttp.test_utils import make_mocked_coro
from virtool.indexes.db import (
    attach_files,
    get_current_id_and_version,
    get_next_version,
    get_patched_otus,
    update_last_indexed_versions,
)
from virtool.indexes.models import SQLIndexFile


@pytest.mark.parametrize("index_id", [None, "abc"])
async def test_create(
    index_id, mocker, snapshot, mongo, test_random_alphanumeric, static_time
):
    await mongo.references.insert_one({"_id": "foo"})

    await mongo.history.insert_one(
        {
            "_id": "abc",
            "index": {"id": "unbuilt", "version": "unbuilt"},
            "reference": {"id": "foo"},
        }
    )

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    document = await virtool.indexes.db.create(
        mongo, "foo", "test", "bar", index_id=index_id
    )

    assert document == snapshot
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


async def test_processor(snapshot, fake2, mongo):
    user = await fake2.users.create()

    await mongo.history.insert_many(
        [
            {"_id": "foo.0", "index": {"id": "baz"}, "otu": {"id": "foo"}},
            {"_id": "foo.1", "index": {"id": "baz"}, "otu": {"id": "foo"}},
            {"_id": "bar.0", "index": {"id": "baz"}, "otu": {"id": "bar"}},
            {"_id": "bar.1", "index": {"id": "baz"}, "otu": {"id": "bar"}},
            {"_id": "bar.2", "index": {"id": "baz"}, "otu": {"id": "bar"}},
            {"_id": "far.0", "index": {"id": "boo"}, "otu": {"id": "foo"}},
        ],
        session=None,
    )

    assert (
        await virtool.indexes.db.processor(
            mongo, {"_id": "baz", "user": {"id": user.id}}
        )
        == snapshot
    )


async def test_get_patched_otus(mocker, mongo, config):
    m = mocker.patch(
        "virtool.history.db.patch_to_version",
        make_mocked_coro((None, {"_id": "foo"}, None)),
    )

    manifest = {"foo": 2, "bar": 10, "baz": 4}

    patched_otus = await get_patched_otus(mongo, config, manifest)

    assert list(patched_otus) == [{"_id": "foo"}, {"_id": "foo"}, {"_id": "foo"}]

    m.assert_has_calls(
        [
            mocker.call(config.data_path, mongo, "foo", 2),
            mocker.call(config.data_path, mongo, "bar", 10),
            mocker.call(config.data_path, mongo, "baz", 4),
        ]
    )


async def test_update_last_indexed_versions(mongo, test_otu, spawn_client):
    client = await spawn_client(authenticated=True)
    test_otu["version"] = 1

    await mongo.otus.insert_one(test_otu)

    async with mongo.create_session() as session:
        await update_last_indexed_versions(mongo, "hxn167", session)

    document = await mongo.otus.find_one({"reference.id": "hxn167"})

    assert document["last_indexed_version"] == document["version"]


async def test_attach_files(snapshot, pg: AsyncEngine):
    index_1 = SQLIndexFile(
        id=1, name="reference.1.bt2", index="foo", type="bowtie2", size=1234567
    )
    index_2 = SQLIndexFile(
        id=2, name="reference.2.bt2", index="foo", type="bowtie2", size=1234567
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2])
        await session.commit()

    document = {"_id": "foo", "reference": {"id": "bar"}}

    assert (
        await attach_files(pg, "https://virtool.example.com/api", document) == snapshot
    )
