import asyncio

import motor.motor_asyncio
import pytest
from aiohttp.test_utils import make_mocked_coro
from motor.motor_asyncio import AsyncIOMotorDatabase

import virtool.mongo.core
from virtool.mongo.identifier import FakeIdProvider


class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


@pytest.fixture
def create_delete_result():
    return MockDeleteResult


@pytest.fixture
def mongo_connection_string(request):
    """The connection string for the MongoDB testing instance."""
    return request.config.getoption("db_connection_string")


@pytest.fixture
def mongo_name(worker_id):
    return f"vt-test-{worker_id}"


@pytest.fixture
async def test_motor(mongo_connection_string, mongo_name, loop, request):
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_connection_string)
    await client.drop_database(mongo_name)
    db: AsyncIOMotorDatabase = client[mongo_name]

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

    yield db
    await client.drop_database(mongo_name)


@pytest.fixture
def mongo(test_motor):
    return virtool.mongo.core.Mongo(test_motor, FakeIdProvider())


@pytest.fixture(params=[True, False])
def id_exists(mocker, request):
    mock = mocker.patch(
        "virtool.mongo.utils.id_exists", make_mocked_coro(request.param)
    )
    setattr(mock, "__bool__", lambda x: request.param)
    return mock
