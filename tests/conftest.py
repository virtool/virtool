from .fixtures.db import *
from .fixtures.documents import *
from .fixtures.client import *
from .fixtures.core import *
from .fixtures.history import *
from .fixtures.hmm import *
from .fixtures.users import *
from .fixtures.viruses import *
from .fixtures.jobs import *
from .fixtures.dispatcher import *
from .fixtures.nv import *


def pytest_addoption(parser):
    parser.addoption("--quick", action="store_true", help="Skip slower tests")
