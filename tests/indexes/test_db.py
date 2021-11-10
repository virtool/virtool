import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.indexes.db
from virtool.indexes.db import (attach_files, get_current_id_and_version,
                                get_next_version, get_patched_otus,
                                update_last_indexed_versions)
from virtool.indexes.models import IndexFile


@pytest.mark.parametrize("index_id", [None, "abc"])
async def test_create(index_id, mocker, snapshot, dbi, test_random_alphanumeric, static_time):
    await dbi.references.insert_one({
        "_id": "foo"
    })

    await dbi.history.insert_one({
        "_id": "abc",
        "index": {
            "id": "unbuilt",
            "version": "unbuilt"
        },
        "reference": {
            "id": "foo"
        }
    })

    mocker.patch(
        "virtool.references.db.get_manifest",
        make_mocked_coro("manifest")
    )

    document = await virtool.indexes.db.create(dbi, "foo", "test", "bar", index_id=index_id)

    assert document == snapshot
    assert await dbi.history.find_one("abc") == snapshot


@ pytest.mark.parametrize("exists", [True, False])
@ pytest.mark.parametrize("has_ref", [True, False])
async def test_get_current_id_and_version(exists, has_ref, test_indexes, dbi):
    if not exists:
        test_indexes = [dict(i, ready=False, has_files=False)
                        for i in test_indexes]

    await dbi.indexes.insert_many(test_indexes)

    ref_id = "hxn167" if has_ref else "foobar"

    index_id, index_version = await get_current_id_and_version(dbi, ref_id)

    if has_ref and exists:
        assert index_id == "ptlrcefm"
        assert index_version == 3

    else:
        assert index_id is None
        assert index_version == -1


@ pytest.mark.parametrize("empty", [False, True])
@ pytest.mark.parametrize("has_ref", [True, False])
async def test_get_next_version(empty, has_ref, test_indexes, dbi):
    if not empty:
        await dbi.indexes.insert_many(test_indexes)

    expected = 4

    if empty or not has_ref:
        expected = 0

    assert await get_next_version(dbi, "hxn167" if has_ref else "foobar") == expected


async def test_processor(mocker, dbi):
    await dbi.history.insert_many([
        {
            "_id": "foo.0",
            "index": {
                "id": "baz"
            },
            "otu": {
                "id": "foo"
            }
        },
        {
            "_id": "foo.1",
            "index": {
                "id": "baz"
            },
            "otu": {
                "id": "foo"
            }
        },
        {
            "_id": "bar.0",
            "index": {
                "id": "baz"
            },
            "otu": {
                "id": "bar"
            }
        },
        {
            "_id": "bar.1",
            "index": {
                "id": "baz"
            },
            "otu": {
                "id": "bar"
            }
        },
        {
            "_id": "bar.2",
            "index": {
                "id": "baz"
            },
            "otu": {
                "id": "bar"
            }
        },
        {
            "_id": "far.0",
            "index": {
                "id": "boo"
            },
            "otu": {
                "id": "foo"
            }
        }
    ])

    document = {
        "_id": "baz"
    }

    result = await virtool.indexes.db.processor(dbi, document)

    assert result == {
        "id": "baz",
        "change_count": 5,
        "modified_otu_count": 2
    }


async def test_get_patched_otus(mocker, dbi, config):
    m = mocker.patch(
        "virtool.history.db.patch_to_version",
        make_mocked_coro((None, {"_id": "foo"}, None))
    )

    manifest = {
        "foo": 2,
        "bar": 10,
        "baz": 4
    }

    patched_otus = await get_patched_otus(
        dbi,
        config,
        manifest
    )

    assert list(patched_otus) == [
        {"_id": "foo"},
        {"_id": "foo"},
        {"_id": "foo"}
    ]

    app_dict = {
        "db": dbi,
        "config": config
    }

    m.assert_has_calls([
        mocker.call(app_dict, "foo", 2),
        mocker.call(app_dict, "bar", 10),
        mocker.call(app_dict, "baz", 4)
    ])


async def test_update_last_indexed_versions(dbi, test_otu, spawn_client):
    client = await spawn_client(authorize=True)
    test_otu["version"] = 1

    await client.db.otus.insert_one(test_otu)

    await update_last_indexed_versions(dbi, "hxn167")

    document = await client.db.otus.find_one({"reference.id": "hxn167"})

    assert document["last_indexed_version"] == document["version"]


async def test_attach_files(snapshot, pg, pg_session):
    index_1 = IndexFile(
        id=1,
        name="reference.1.bt2",
        index="foo",
        type="bowtie2",
        size=1234567
    )
    index_2 = IndexFile(
        id=2,
        name="reference.2.bt2",
        index="foo",
        type="bowtie2",
        size=1234567
    )

    async with pg_session as session:
        session.add_all([index_1, index_2])
        await session.commit()

    document = {
        "_id": "foo",
        "reference": {
            "id": "bar"
        }
    }

    assert await attach_files(pg, document) == snapshot


async def test_finalize(snapshot, dbi, pg, pg_session):
    await dbi.indexes.insert_one({
        "_id": "foo",
        "reference": {
            "id": "bar"
        }
    })

    index_1 = IndexFile(
        id=1,
        name="reference.1.bt2",
        index="foo",
        type="bowtie2",
        size=1234567
    )

    index_2 = IndexFile(
        id=2,
        name="reference.2.bt2",
        index="foo",
        type="bowtie2",
        size=1234567
    )

    async with pg_session as session:
        session.add_all([index_1, index_2])
        await session.commit()

    # Ensure return value is correct.
    assert await virtool.indexes.db.finalize(dbi, pg, "bar", "foo") == snapshot

    # Ensure document in database is correct.
    assert await dbi.indexes.find_one() == snapshot
