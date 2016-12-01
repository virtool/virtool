import os
import pytest

from virtool.testing.mock_mongo import session_mongo


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

    def create():
        return Func()

    return create


@pytest.fixture(scope="function")
def temp_mongo(session_mongo, io_loop):
    import motor

    yield motor.MotorClient(io_loop=io_loop)[session_mongo.name]

    session_mongo.clean()
