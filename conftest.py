from virtool.tests.fixtures.db import *
from virtool.tests.fixtures.client import *
from virtool.tests.fixtures.groups import *
from virtool.tests.fixtures.sessions import *
from virtool.tests.fixtures.documents import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
