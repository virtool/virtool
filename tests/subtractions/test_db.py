import virtool.subtractions.db


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
