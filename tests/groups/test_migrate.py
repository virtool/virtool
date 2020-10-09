import virtool.groups.migrate


async def test_migrate_groups(dbi):
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

    documents = await dbi.groups.find().to_list(None)

    assert documents == [{
        "_id": "foobar",
        "permissions": {
            "cancel_job": False,
            "create_ref": False,
            "create_sample": True,
            "modify_hmm": False,
            "modify_subtraction": False,
            "remove_file": False,
            "remove_job": False,
            "upload_file": False
        }
    }]