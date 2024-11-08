from random import choices
from string import ascii_lowercase

import motor.motor_asyncio
import pytest
from aiohttp.test_utils import make_mocked_coro
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import WriteConcern

import virtool.mongo.core
from virtool.mongo.identifier import FakeIdProvider


@pytest.fixture(scope="session")
def mongo_connection_string(request):
    """The connection string for the MongoDB testing instance."""
    return request.config.getoption("db_connection_string")


@pytest.fixture()
def mongo_name(worker_id: str) -> str:
    suffix = "".join(choices(ascii_lowercase, k=3))
    return f"vt-test-{worker_id}-{suffix}"


@pytest.fixture(scope="session")
async def motor_client(mongo_connection_string: str):
    return motor.motor_asyncio.AsyncIOMotorClient(
        mongo_connection_string,
        maxPoolSize=10,
        minPoolSize=0,
        maxIdleTimeMS=30000,
        socketTimeoutMS=20000,
        connectTimeoutMS=20000,
        serverSelectionTimeoutMS=20000,
        waitQueueTimeoutMS=10000,
        zlibCompressionLevel=0,
    )


@pytest.fixture()
async def motor_database(
    motor_client: motor.motor_asyncio.AsyncIOMotorClient,
    mongo_name: str,
):
    database: AsyncIOMotorDatabase = motor_client[mongo_name]

    yield database

    # This gives a significant cumulative performance benefit over:
    # await motor_client.drop_database(mongo_name)``.
    await database.command(
        {"dropDatabase": 1},
        write_concern=WriteConcern(w=0),
    )


@pytest.fixture()
def mongo(motor_database: AsyncIOMotorDatabase):
    return virtool.mongo.core.Mongo(motor_database, FakeIdProvider())


@pytest.fixture(params=[True, False])
def id_exists(mocker, request):
    mock = mocker.patch(
        "virtool.mongo.utils.id_exists",
        make_mocked_coro(request.param),
    )
    mock.__bool__ = lambda x: request.param
    return mock
