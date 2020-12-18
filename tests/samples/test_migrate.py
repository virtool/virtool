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
            "subtraction": {
                "id": "malus"
            }
        }
    ])

    await virtool.samples.migrate.change_to_subtractions_list(dbi)

    snapshot.assert_match(await dbi.samples.find().to_list(None))
