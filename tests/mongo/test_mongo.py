import pytest

from virtool.mongo.connect import check_mongo_version


@pytest.mark.parametrize("version", ["3.5.9", "3.6.0", "3.6.1"])
async def test_check_mongo_version(version: str, log, test_motor, mocker):
    mocker.patch("virtool.mongo.connect.get_mongo_version", return_value=version)

    try:
        await check_mongo_version(test_motor)
        assert log.has("Found MongoDB", version=version)
    except SystemExit as e:
        assert e.code == 1
