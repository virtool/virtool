import pytest

import virtool.subtractions.db
from virtool.subtractions.db import unlink_default_subtractions


async def test_attach_subtractions(dbi):
    await dbi.subtraction.insert_many([
        {
            "_id": "foo",
            "name": "Foo"
        },
        {
            "_id": "bar",
            "name": "Bar"
        }
    ])

    document = {
        "_id": "foobar",
        "subtractions": ["foo", "bar"]
    }

    result = await virtool.subtractions.db.attach_subtractions(dbi, document)

    assert result == {
        "_id": "foobar",
        "subtractions": [
            {
                "id": "foo",
                "name": "Foo"
            },
            {
                "id": "bar",
                "name": "Bar"
            }
        ]
    }


async def test_get_linked_samples(dbi):
    await dbi.samples.insert_many([
        {"_id": "foo", "name": "Foo", "subtractions": ["1", "5", "3"]},
        {"_id": "bar", "name": "Bar", "subtractions": ["2", "5", "8"]},
        {"_id": "baz", "name": "Baz", "subtractions": ["2"]}
    ])

    samples = await virtool.subtractions.db.get_linked_samples(dbi, "5")

    assert samples == [
        {
            "id": "foo",
            "name": "Foo"
        },
        {
            "id": "bar",
            "name": "Bar"
        }
    ]


async def test_unlink_default_subtractions(dbi):
    await dbi.samples.insert_many([
        {"_id": "foo", "subtractions": ["1", "2", "3"]},
        {"_id": "bar", "subtractions": ["2", "5", "8"]},
        {"_id": "baz", "subtractions": ["2"]}
    ])

    await unlink_default_subtractions(dbi, "2")

    assert await dbi.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["1", "3"]},
        {"_id": "bar", "subtractions": ["5", "8"]},
        {"_id": "baz", "subtractions": []}
    ]


@pytest.mark.parametrize("subtraction_id", [None, "abc"])
async def test_create(subtraction_id, dbi, test_random_alphanumeric):
    user_id = "test"
    filename = "subtraction.fa.gz"

    document = await virtool.subtractions.db.create(
        dbi,
        user_id,
        filename,
        "Foo",
        "foo",
        1,
        subtraction_id=subtraction_id)

    expected_subtraction_id = test_random_alphanumeric.history[0] if subtraction_id is None else "abc"

    assert document == {
        "_id": expected_subtraction_id,
        "name": "Foo",
        "nickname": "foo",
        "deleted": False,
        "ready": False,
        "is_host": True,
        "file": {
            "id": 1,
            "name": "subtraction.fa.gz"
        },
        "user": {
            "id": "test"
        }
    }


async def test_finalize(dbi, pg):
    await dbi.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
    })

    gc = {
        "a": 0.319,
        "t": 0.319,
        "g": 0.18,
        "c": 0.18,
        "n": 0.002
    }

    document = await virtool.subtractions.db.finalize(dbi, pg, "foo", gc)
    assert document == {
        "_id": "foo",
        "name": "Foo",
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        },
        "ready": True
    }
