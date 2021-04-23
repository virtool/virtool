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


async def test_add_library_type(snapshot, dbi):
    """
    Test that samples are assigned a library_type field with different `srna` field values.

    """
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


async def test_prune_fields(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "imported": True,
            "analyzed": False,
            "archived": False
        },
        {
            "_id": "bar",
            "imported": "ip",
            "ready": True
        }
    ])

    await virtool.samples.migrate.prune_fields(dbi)

    snapshot.assert_match(await dbi.samples.find().to_list(None))


async def test_update_pairedness(snapshot, dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "files": [
                "1"
            ]
        },
        {
            "_id": "bar",
            "files": [
                "1",
                "2"
            ]
        },
        {
            "_id": "baz",
            "paired": True
        },
        {
            "_id": "boo",
            "paired": False
        }
    ])

    await virtool.samples.migrate.update_pairedness(dbi)

    snapshot.assert_match(await dbi.samples.find().to_list(None))


async def test_update_ready(snapshot, dbi):
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
            "ready": False
        },
        {
            "_id": "far",
            "ready": True
        }
    ])

    await virtool.samples.migrate.update_ready(dbi.motor_client)

    snapshot.assert_match(await dbi.samples.find().to_list(None))
