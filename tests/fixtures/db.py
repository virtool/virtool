import pytest
import pymongo
import motor.motor_asyncio


class MockDeleteResult:

    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


@pytest.fixture
def test_db():
    client = pymongo.MongoClient()
    client.drop_database("test")
    yield client["test"]
    client.drop_database("test")


@pytest.fixture
def test_motor(test_db, loop):
    client = motor.motor_asyncio.AsyncIOMotorClient(io_loop=loop)
    loop.run_until_complete(client.drop_database("test"))
    yield client["test"]
    loop.run_until_complete(client.drop_database("test"))


@pytest.fixture
def create_delete_result():
    return MockDeleteResult
