import virtool.groups.migrate


async def test_migrate_groups(snapshot, dbi):
    await dbi.groups.insert_many([
        {
            "_id": "foobar",
            "permissions": {
                "hello_world": True,
                "create_sample": True
            }
        }
    ])

    app = {"db": dbi}

    await virtool.groups.migrate.migrate_groups(app)

    assert await dbi.groups.find().to_list(None) == snapshot
