import virtool.samples.migrate


async def test_add_library_type(snapshot, dbi):
    """
    Test that samples are assigned a library_type field with different `srna` field values.

    """
    await dbi.motor_client.samples.insert_many([
        {
            "_id": "foo",
            "srna": True
        },
        {
            "_id": "bar",
            "srna": False
        },
        {
            "_id": "baz"
        }
    ])

    await virtool.samples.migrate.add_library_type(dbi.motor_client)

    documents = await dbi.samples.find({}).to_list(None)

    assert documents == [
        {
            "_id": "foo",
            "library_type": "srna"
        },
        {
            "_id": "bar",
            "library_type": "normal"
        },
        {
            "_id": "baz",
            "library_type": "normal"
        }
    ]
