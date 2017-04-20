import pytest
import pymongo
import motor.motor_asyncio


@pytest.fixture
def test_db():
    client = pymongo.MongoClient()
    yield client["test"]
    client.drop_database("test")


@pytest.fixture
def test_motor(test_db, loop):
    client = motor.motor_asyncio.AsyncIOMotorClient(io_loop=loop)
    yield client["test"]
