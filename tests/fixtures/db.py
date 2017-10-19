import pytest
import pymongo
import motor.motor_asyncio


class MockDeleteResult:

    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


@pytest.fixture()
def test_db_name(worker_id):
    return "vt-test-{}".format(worker_id)


@pytest.fixture
def test_db(test_db_name):
    client = pymongo.MongoClient()
    client.drop_database(test_db_name)

    yield client[test_db_name]

    client.drop_database(test_db_name)


@pytest.fixture
def test_motor(test_db, test_db_name, loop):
    client = motor.motor_asyncio.AsyncIOMotorClient(io_loop=loop)
    loop.run_until_complete(client.drop_database(test_db_name))
    yield client[test_db_name]
    loop.run_until_complete(client.drop_database(test_db_name))


@pytest.fixture
def create_delete_result():
    return MockDeleteResult
