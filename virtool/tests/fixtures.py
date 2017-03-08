import os
import pytest
import virtool.gen

from virtool.permissions import PERMISSIONS

from virtool.tests.mock_settings import MockSettings
from virtool.tests.mock_interface import EmptyInterface, MockInterface
from virtool.tests.mock_connection import MockConnection
from virtool.tests.mock_transaction import MockTransaction


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


@pytest.fixture
def coroutine_stub(mocker):
    def create(name):
        stub = mocker.stub(name=name)

        @virtool.gen.coroutine
        def decorated(*args, **kwargs):
            return stub(*args, **kwargs)

        decorated.stub = stub

        return decorated

    return create


@pytest.fixture
def mock_collection(mocker):
    class MockCollection:

        def __init__(self):
            self.stubs = dict()

        def add_method(self, name):
            stub = mocker.stub(name=name)
            self.stubs[name] = stub

            setattr(self, name, stub)

        def add_coroutine(self, name):
            stub = mocker.stub(name=name)

            self.stubs[name] = stub

            @virtool.gen.coroutine
            def coroutine(*args, **kwargs):
                return stub(*args, **kwargs)

            setattr(self, name, coroutine)

    return MockCollection()


@pytest.fixture()
def mock_settings(mock_pymongo, mock_motor):
    settings = MockSettings()

    def get_db_client(sync=False):
        if sync:
            return mock_pymongo
        return mock_motor

    settings.get_db_client = get_db_client

    return settings


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
    def create_connection(source=None, username="test", permissions="all", administrator=False, authorized=True,
                          ip="127.0.0.1", auto=True):

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

        conn = MockConnection(web_settings, new_user, authorized, ip)

        if auto:
            conn.open()

        return conn

    return create_connection


@pytest.fixture
def mock_transaction(mock_connection):
    def create_transaction(message, username="test", permissions=None, administrator=False, authorized=True,
                           ip="127.0.0.1"):
        connection = mock_connection(
            username=username,
            permissions=permissions,
            administrator=administrator,
            authorized=authorized,
            ip=ip
        )
        return MockTransaction(message, connection)

    return create_transaction


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
