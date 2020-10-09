import virtool.files.migrate


async def test_migrate_files(dbi):
    documents = [
        {"_id": 1},
        {"_id": 2},
        {"_id": 3, "reserved": False},
        {"_id": 4, "reserved": True}
    ]

    await dbi.files.insert_many(documents)

    app = {"db": dbi}

    await virtool.files.migrate.migrate_files(app)

    async for document in dbi.files.find():
        assert document["reserved"] is False