from virtool.migration.check import check_data_revision_version


async def test_check_revision(mongo, spawn_client):
    await mongo.migrations.insert_one(
        {
            "_id": "test",
            "applied_at": "2022-11-16T23:58:55.651Z",
            "created_at": "2022-06-09T20:38:11Z",
            "name": "Nest analysis results field",
            "revision_id": "7emq1brv0zz6",
        }
    )

    try:
        await check_data_revision_version(mongo)

    except SystemExit as e:
        assert e.code == 1
