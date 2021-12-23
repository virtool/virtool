import pytest

import virtool.subtractions.db
from virtool.subtractions.db import unlink_default_subtractions


async def test_attach_subtractions(dbi):
    await dbi.subtraction.insert_many(
        [{"_id": "foo", "name": "Foo"}, {"_id": "bar", "name": "Bar"}]
    )

    document = {"_id": "foobar", "subtractions": ["foo", "bar"]}

    result = await virtool.subtractions.db.attach_subtractions(dbi, document)

    assert result == {
        "_id": "foobar",
        "subtractions": [{"id": "foo", "name": "Foo"}, {"id": "bar", "name": "Bar"}],
    }


async def test_get_linked_samples(dbi):
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "subtractions": ["1", "5", "3"]},
            {"_id": "bar", "name": "Bar", "subtractions": ["2", "5", "8"]},
            {"_id": "baz", "name": "Baz", "subtractions": ["2"]},
        ]
    )

    samples = await virtool.subtractions.db.get_linked_samples(dbi, "5")

    assert samples == [{"id": "foo", "name": "Foo"}, {"id": "bar", "name": "Bar"}]


async def test_unlink_default_subtractions(dbi):
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "subtractions": ["1", "2", "3"]},
            {"_id": "bar", "subtractions": ["2", "5", "8"]},
            {"_id": "baz", "subtractions": ["2"]},
        ]
    )

    await unlink_default_subtractions(dbi, "2")

    assert await dbi.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["1", "3"]},
        {"_id": "bar", "subtractions": ["5", "8"]},
        {"_id": "baz", "subtractions": []},
    ]


@pytest.mark.parametrize("subtraction_id", [None, "abc"])
async def test_create(
    subtraction_id, snapshot, dbi, test_random_alphanumeric, static_time
):
    user_id = "test"
    filename = "subtraction.fa.gz"

    document = await virtool.subtractions.db.create(
        dbi, user_id, filename, "Foo", "foo", 1, subtraction_id=subtraction_id
    )

    assert document == snapshot
    assert await dbi.subtraction.find_one() == snapshot


async def test_finalize(snapshot, dbi, pg):
    await dbi.subtraction.insert_one(
        {
            "_id": "foo",
            "name": "Foo",
        }
    )

    gc = {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002}

    result = await virtool.subtractions.db.finalize(dbi, pg, "foo", gc, 100)

    assert result == snapshot
    assert await dbi.subtraction.find_one() == snapshot
