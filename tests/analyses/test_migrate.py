import virtool.analyses.migrate


async def test_change_to_subtractions_list(snapshot, dbi):
    await dbi.analyses.insert_many([
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

    await virtool.analyses.migrate.change_to_subtractions_list(dbi)

    snapshot.assert_match(await dbi.analyses.find().to_list(None))
