import pytest
import pymongo
import motor

from virtool.utils import random_alphanumeric


class MockMongo:

    def __init__(self):
        # A temporary database.
        self.name = "vt-test-" + random_alphanumeric(12)

        # A synchronous connection to the database.
        self.pymongo = pymongo.MongoClient()[self.name]

        self.collection_names = [
            "jobs",
            "samples",
            "analyses",
            "sequences",
            "viruses",
            "hmm",
            "history",
            "indexes",
            "hosts",
            "groups",
            "users",
            "files"
        ]

        # Add all of Virtool's collections to the temporary database.
        for collection_name in self.collection_names:
            self.pymongo.create_collection(collection_name)

        for collection_name in self.pymongo.collection_names():
            self.__setattr__(collection_name, self.pymongo[collection_name])

    def clean(self):
        for collection_name in self.collection_names:
            self.pymongo[collection_name].remove({})

    def delete(self):
        pymongo.MongoClient().drop_database(self.name)


@pytest.fixture(scope="session")
def mock_mongo():
    mock = MockMongo()
    yield mock
    mock.delete()


@pytest.fixture(scope="function")
def mock_motor(mock_mongo, io_loop):
    yield motor.MotorClient(io_loop=io_loop)[mock_mongo.name]
    mock_mongo.clean()


@pytest.fixture(scope="function")
def mock_pymongo(mock_mongo):
    import pymongo
    yield pymongo.MongoClient()[mock_mongo.name]
    mock_mongo.clean()
