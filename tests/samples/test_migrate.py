import virtool.samples.migrate


async def test_change_to_subtractions_list(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "subtraction": {
                "id": "prunus"
            }
        },
        {
            "_id": "bar",
            "subtraction": {
                "id": "malus"
            }
        },
        {
            "_id": "baz",
            "subtraction": None
        }
    ])

    await virtool.samples.migrate.change_to_subtractions_list(dbi)

    assert await dbi.samples.find().to_list(None) == [
        {
            "_id": "foo",
            "subtractions": ["prunus"]
        },
        {
            "_id": "bar",
            "subtractions": ["malus"]
        },
        {
            "_id": "baz",
            "subtractions": []
        }
    ]
