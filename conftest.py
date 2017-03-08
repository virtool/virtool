from virtool.tests.fixtures import *
from virtool.tests.fixtures_mongo import mock_mongo, mock_pymongo, mock_motor
from virtool.tests.fixtures_viruses import *
from virtool.tests.fixtures_users import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
