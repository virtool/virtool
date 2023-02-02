import logging

import pytest

from virtool.mongo.connect import check_mongo_version, check_revision


@pytest.mark.parametrize("version", ["3.5.9", "3.6.0", "3.6.1"])
async def test_check_mongo_version(mongo, caplog, mocker, version):
    mocker.patch("virtool.mongo.connect.get_mongo_version", return_value=version)

    caplog.set_level(logging.INFO)

    try:
        await check_mongo_version(mongo)

        assert caplog.messages[0] == f"Found MongoDB {version}"
    except SystemExit as e:
        assert e.code == 1


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
        await check_revision(mongo)

    except SystemExit as e:
        assert e.code == 1

