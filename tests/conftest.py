from tests.fixtures.client import *
from tests.fixtures.core import *
from tests.fixtures.db import *
from tests.fixtures.dispatcher import *
from tests.fixtures.documents import *
from tests.fixtures.groups import *
from tests.fixtures.history import *
from tests.fixtures.indexes import *
from tests.fixtures.jobs import *
from tests.fixtures.postgres import *
from tests.fixtures.redis import *
from tests.fixtures.references import *
from tests.fixtures.response import *
from tests.fixtures.setup import *
from tests.fixtures.users import *
from tests.fixtures.otus import *
from tests.fixtures.uploads import *


def pytest_addoption(parser):
    parser.addoption(
        "--db-connection-string",
        action="store",
        default="mongodb://localhost:27017"
    )

    parser.addoption(
        "--redis-connection-string",
        action="store",
        default="redis://localhost:6379"
    )

    parser.addoption(
        "--postgres-connection-string",
        action="store",
        default="postgresql+asyncpg://virtool:virtool@localhost"
    )
