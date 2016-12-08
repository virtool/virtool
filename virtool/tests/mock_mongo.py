import pytest
import pymongo

from virtool.utils import random_alphanumeric


@pytest.fixture(scope="session")
def session_mongo():
    mock = Mongo()
    yield mock
    mock.delete()


class Mongo:

    def __init__(self, async=True):
        # A temporary database.
        self.name = "vt-test-" + random_alphanumeric(12)

        # A synchronous connection to the database.
        self.pymongo = pymongo.MongoClient()[self.name]

        self.collection_names = [
            "jobs",
            "samples",
            "analyses",
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

