from virtool.tests.fixtures import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
