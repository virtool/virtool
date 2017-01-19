import os
import pytest

from virtool.permissions import PERMISSIONS

from virtool.tests.mock_mongo import MockMongo
from virtool.tests.mock_settings import MockSettings
from virtool.tests.mock_interface import EmptyInterface, MockInterface
from virtool.tests.mock_connection import MockConnection
from virtool.tests.mock_transaction import MockTransaction


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")


@pytest.fixture(scope="session")
def mock_settings():
    return MockSettings()


@pytest.fixture()
def empty_interface(called_tester):
    return EmptyInterface


@pytest.fixture()
def mock_interface():
    return MockInterface


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


@pytest.fixture(scope="function")
def mock_connection(user, called_tester):
    def create_connection(source=None, username="test", permissions="all", administrator=False, authorized=True, auto=True):

        method_keys = ["add_connection", "remove_connection", "handle"]

        if isinstance(source, dict):
            web_settings = {key: source[key] for key in method_keys}
        elif source is None:
            web_settings = {key: called_tester() for key in method_keys}
        else:
            web_settings = {key: getattr(source, key) for key in method_keys}

        new_user = user(
            name=username,
            permissions=permissions,
            administrator=administrator
        )

        conn = MockConnection(web_settings, new_user, authorized)

        if auto:
            conn.open()

        return conn

    return create_connection


@pytest.fixture
def mock_transaction(mock_connection):
    def create_transaction(message, username="test", permissions=None, administrator=False, authorized=True):
        connection = mock_connection(
            username=username,
            permissions=permissions,
            administrator=administrator,
            authorized=authorized
        )
        return MockTransaction(message, connection)

    return create_transaction


@pytest.fixture(scope="session")
def mock_mongo():
    mock = MockMongo()
    yield mock
    mock.delete()


@pytest.fixture(scope="function")
def temp_mongo(mock_mongo, io_loop):
    import motor

    yield motor.MotorClient(io_loop=io_loop)[mock_mongo.name]

    mock_mongo.clean()


@pytest.fixture(scope="session")
def static_time():
    from datetime import datetime
    return datetime(2000, 1, 1)


@pytest.fixture(scope="session")
def data_dir(tmpdir_factory):
    # Set up a mock data directory.
    mock_dir = tmpdir_factory.mktemp("data")

    for path in ["download", "hmm", "logs", "reference", "samples", "upload"]:
        os.mkdir(os.path.join(str(mock_dir), path))

    return mock_dir


@pytest.fixture(scope="session")
def called_tester():

    class Func:

        def __init__(self):
            self.was_called = False
            self.with_args = None
            self.with_kwargs = None

        def __call__(self, *args, **kwargs):
            self.was_called = True
            self.with_args = args
            self.with_kwargs = kwargs

    return Func

