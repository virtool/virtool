import virtool.samples.migrate


async def test_add_is_legacy(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "files": [
                {"id": 1, "raw": False}
            ]
        },
        {
            "_id": "bar",
            "files": [
                {"id": 1, "raw": True}
            ]
        }
    ])

    await virtool.samples.migrate.add_is_legacy(dbi)

    snapshot.assert_match(await dbi.samples.find().to_list(None))


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
