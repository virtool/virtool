import virtool.subtractions.migrate


async def test_add_name_field(dbi):
    await dbi.subtraction.insert_many([
        {
            "_id": "Foo"
        },
        {
            "_id": "Bar",
            "name": "Baz"
        }
    ])

    await virtool.subtractions.migrate.add_name_field(dbi)

    assert await dbi.subtraction.find().to_list(None) == [
        {
            "_id": "Foo",
            "name": "Foo"
        },
        {
            "_id": "Bar",
            "name": "Baz"
        }
    ]
