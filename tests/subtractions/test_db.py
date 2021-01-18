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

    await virtool.subtractions.db.attach_subtractions(dbi, document)

    assert document == {
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