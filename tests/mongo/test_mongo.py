import logging

import pytest

from virtool.mongo.connect import check_mongo_version


@pytest.mark.parametrize("version", ["3.5.9", "3.6.0", "3.6.1"])
async def test_check_mongo_version(mongo, caplog, mocker, version):
    mocker.patch("virtool.mongo.connect.get_mongo_version", return_value=version)

    caplog.set_level(logging.INFO)

    try:
        await check_mongo_version(mongo)

        assert caplog.messages[0] == f"Found MongoDB {version}"
    except SystemExit as e:
        assert e.code == 1