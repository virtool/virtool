import virtool.mongo.utils


async def test_check_missing_ids(mongo):
    await mongo.subtraction.insert_many(
        [
            {
                "_id": "foo",
                "name": "Foo",
            },
            {
                "_id": "bar",
                "name": "Bar",
            },
        ],
        session=None,
    )

    non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
        mongo.subtraction,
        ["foo", "bar", "baz"],
    )

    assert non_existent_subtractions == {"baz"}
