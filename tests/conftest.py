from tests.fixtures.db import *
from tests.fixtures.documents import *
from tests.fixtures.client import *
from tests.fixtures.core import *
from tests.fixtures.history import *
from tests.fixtures.hmm import *
from tests.fixtures.users import *
from tests.fixtures.viruses import *
from tests.fixtures.jobs import *
from tests.fixtures.dispatcher import *
from tests.fixtures.nv import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
