import pytest

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

    assert await dbi.history.count({"index.id": "unbuilt"}) == 8
    assert await dbi.history.count({"reference.id": "foobar", "index.id": "unbuilt"}) == 4
    assert await dbi.history.count({"reference.id": "hxn167", "index.id": "unbuilt"}) == 4

    await virtool.indexes.db.tag_unbuilt_changes(dbi, "hxn167", "foo", 5)

    assert await dbi.history.count({"reference.id": "foobar", "index.id": "unbuilt"}) == 4
    assert await dbi.history.count({"reference.id": "hxn167", "index.id": "foo", "index.version": 5}) == 4
