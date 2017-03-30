import pytest
import pymongo


@pytest.fixture
def test_db():
    client = pymongo.MongoClient()
    yield client["test"]
    client.drop_database("test")
