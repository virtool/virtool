import virtool.samples.migrate


async def test_add_library_type(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "srna": True
        },
        {
            "_id": "bar",
            "srna": False
        },
        {
            "_id": "baz",
            "srna": False
        },
        {
            "_id": "boo",
            "srna": True,
            "library_type": "srna"
        }
    ])

    await virtool.samples.migrate.add_library_type(dbi.motor_client)

    snapshot.assert_match(await dbi.samples.find().to_list(None))


async def test_delete_unready(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "imported": True
        },
        {
            "_id": "bar",
            "imported": "ip"
        },
        {
            "_id": "baz",
            "imported": True
        },
        {
            "_id": "boo",
            "imported": False
        }
    ])

    await virtool.samples.migrate.delete_unready(dbi.motor_client)

    snapshot.assert_match(await dbi.samples.find().to_list(None))




