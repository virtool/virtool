import os
import pytest
import pymongo

from virtool.web import create_app
from virtool.permissions import PERMISSIONS


@pytest.fixture
def test_db():
    client = pymongo.MongoClient()
    yield client["test"]
    client.drop_database("test")


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}


@pytest.fixture(scope="session")
def data_dir(tmpdir_factory):
    # Set up a mock data directory.
    mock_dir = tmpdir_factory.mktemp("data")

    for path in ["download", "hmm", "logs", "reference", "samples", "upload"]:
        os.mkdir(os.path.join(str(mock_dir), path))

    return mock_dir

'''
@pytest.fixture()
def mock_settings(mock_pymongo, mock_motor):
    settings = MockSettings()

    def get_db_client(sync=False):
        if sync:
            return mock_pymongo
        return mock_motor

    settings.get_db_client = get_db_client

    return settings
'''


@pytest.fixture(scope="session")
def user():
    def create_user(name="test", permissions=None, administrator=False):
        if isinstance(permissions, list):
            pass
        elif permissions == "all" or administrator:
            permissions = list(PERMISSIONS)
        else:
            permissions = list()

        permissions = {key: key in permissions for key in PERMISSIONS}

        groups = list()

        if administrator:
            groups.append("administrator")

        return {
            "_id": name,
            "permissions": permissions,
            "groups": groups
        }

    return create_user
