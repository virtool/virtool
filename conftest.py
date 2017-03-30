from virtool.tests.fixtures.db import *
from virtool.tests.fixtures.client import *
from virtool.tests.fixtures.users import *
from virtool.tests.fixtures.documents import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
