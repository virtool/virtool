import pymongo
import motor.motor_asyncio
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.core


class MockDeleteResult:

    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


@pytest.fixture
def test_db_connection_string(request):
    return request.config.getoption("db_connection_string")


@pytest.fixture
def test_db_name(worker_id):
    return "vt-test-{}".format(worker_id)


@pytest.fixture
def test_motor(test_db_connection_string, test_db_name, loop, request):
    client = motor.motor_asyncio.AsyncIOMotorClient(test_db_connection_string)
    loop.run_until_complete(client.drop_database(test_db_name))
    yield client[test_db_name]
    loop.run_until_complete(client.drop_database(test_db_name))


@pytest.fixture
def dbi(test_motor, mocker):
    return virtool.db.core.DB(test_motor, mocker.stub())


@pytest.fixture(params=[True, False])
def id_exists(mocker, request):
    mock = mocker.patch("virtool.db.utils.id_exists", make_mocked_coro(request.param))
    setattr(mock, "__bool__", lambda x: request.param)
    return mock


@pytest.fixture
def create_delete_result():
    return MockDeleteResult
