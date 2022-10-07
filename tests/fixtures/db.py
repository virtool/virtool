import asyncio

import motor.motor_asyncio
import pytest
from aiohttp.test_utils import make_mocked_coro
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.util import asyncio

import virtool.mongo.connect
import virtool.mongo.core
from virtool.mongo.identifier import FakeIdProvider


class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


@pytest.fixture
def test_db_connection_string(request):
    return request.config.getoption("db_connection_string")


@pytest.fixture
def test_db_name(worker_id):
    return f"vt-test-{worker_id}"


@pytest.fixture
async def test_motor(test_db_connection_string, test_db_name, loop, request):
    client = motor.motor_asyncio.AsyncIOMotorClient(test_db_connection_string)
    await client.drop_database(test_db_name)
    db: AsyncIOMotorDatabase = client[test_db_name]

    await asyncio.gather(
        *[
            db.create_collection(collection_name)
            for collection_name in (
                "analyses",
                "groups",
                "history",
                "indexes",
                "jobs",
                "otus",
                "references",
                "samples",
                "settings",
                "subtractions",
                "users",
            )
        ]
    )

    await virtool.mongo.connect.create_indexes(db)
    yield db
    await client.drop_database(test_db_name)


@pytest.fixture
def mongo(test_motor, mocker):
    return virtool.mongo.core.DB(test_motor, mocker.stub(), FakeIdProvider())


@pytest.fixture(params=[True, False])
def id_exists(mocker, request):
    mock = mocker.patch(
        "virtool.mongo.utils.id_exists", make_mocked_coro(request.param)
    )
    setattr(mock, "__bool__", lambda x: request.param)
    return mock


@pytest.fixture
def create_delete_result():
    return MockDeleteResult
