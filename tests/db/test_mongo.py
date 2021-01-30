import logging

import pytest

from virtool.db.mongo import check_mongo_version


@pytest.mark.parametrize("version", ["3.5.9", "3.6.0", "3.6.1"])
async def test_check_mongo_version(dbi, caplog, mocker, version):
    mocker.patch("virtool.db.mongo.get_server_version", return_value=version)

    caplog.set_level(logging.INFO)

    try:
        await check_mongo_version(dbi)

        assert caplog.messages[0] == f"Found MongoDB {version}"
    except SystemExit as e:
        assert e.code == 1
