from virtool.db.migrate_shared import add_subtractions_field


async def test_migrate_subtractions_list(dbi):
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "subtraction": {"id": "prunus"}},
            {"_id": "bar", "subtraction": {"id": "malus"}},
            {"_id": "baz", "subtraction": None},
        ]
    )

    await add_subtractions_field(dbi.samples)

    assert await dbi.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["prunus"]},
        {"_id": "bar", "subtractions": ["malus"]},
        {"_id": "baz", "subtractions": []},
    ]
