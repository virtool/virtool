from tests.fixtures.client import *
from tests.fixtures.core import *
from tests.fixtures.db import *
from tests.fixtures.dispatcher import *
from tests.fixtures.documents import *
from tests.fixtures.groups import *
from tests.fixtures.history import *
from tests.fixtures.indexes import *
from tests.fixtures.jobs import *
from tests.fixtures.references import *
from tests.fixtures.response import *
from tests.fixtures.users import *
from tests.fixtures.otus import *


def pytest_addoption(parser):
    parser.addoption(
        "--db-host",
        action="store",
        default="localhost"
    )
