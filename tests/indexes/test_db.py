import aiohttp.test_utils
import pytest

import virtool.indexes
import virtool.indexes.db
import virtool.errors
import virtool.jobs.build_index


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_current_id_and_version(exists, has_ref, test_indexes, dbi):
    if not exists:
        test_indexes = [dict(i, ready=False, has_files=False) for i in test_indexes]

    await dbi.indexes.insert_many(test_indexes)

    ref_id = "hxn167" if has_ref else "foobar"

    index_id, index_version = await virtool.indexes.db.get_current_id_and_version(dbi, ref_id)

    if has_ref and exists:
        assert index_id == "ptlrcefm"
        assert index_version == 3

    else:
        assert index_id is None
        assert index_version == -1


@pytest.mark.parametrize("empty", [False, True])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_next_version(empty, has_ref, test_indexes, dbi):
    if not empty:
        await dbi.indexes.insert_many(test_indexes)

    expected = 4

    if empty or not has_ref:
        expected = 0

    assert await virtool.indexes.db.get_next_version(dbi, "hxn167" if has_ref else "foobar") == expected


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


async def test_tag_unbuilt_changes(dbi, create_mock_history):
    await create_mock_history(False)

    async for document in dbi.history.find():
        await dbi.history.insert_one({
            **document,
            "_id": "foo_" + document["_id"],
            "reference": {
                "id": "foobar"
            }
        })

    assert await dbi.history.count_documents({"index.id": "unbuilt"}) == 8
    assert await dbi.history.count_documents({"reference.id": "foobar", "index.id": "unbuilt"}) == 4
    assert await dbi.history.count_documents({"reference.id": "hxn167", "index.id": "unbuilt"}) == 4

    await virtool.indexes.db.tag_unbuilt_changes(dbi, "hxn167", "foo", 5)

    assert await dbi.history.count_documents({"reference.id": "foobar", "index.id": "unbuilt"}) == 4
    assert await dbi.history.count_documents({"reference.id": "hxn167", "index.id": "foo", "index.version": 5}) == 4


async def test_get_patched_otus(mocker, dbi):
    m = mocker.patch("virtool.history.db.patch_to_version", aiohttp.test_utils.make_mocked_coro((None, {"_id": "foo"}, None)))

    manifest = {
        "foo": 2,
        "bar": 10,
        "baz": 4
    }

    settings = {
        "data_path": "foo"
    }

    patched_otus = await virtool.indexes.db.get_patched_otus(
        dbi,
        settings,
        manifest
    )

    assert list(patched_otus) == [
        {"_id": "foo"},
        {"_id": "foo"},
        {"_id": "foo"}
    ]

    app_dict = {
        "db": dbi,
        "settings": settings
    }

    m.assert_has_calls([
        mocker.call(app_dict, "foo", 2),
        mocker.call(app_dict, "bar", 10),
        mocker.call(app_dict, "baz", 4)
    ])