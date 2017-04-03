import pytz
import pytest

from datetime import datetime


@pytest.fixture
def static_time():
    return datetime(2017, 10, 6, 20, 0, 0, tzinfo=pytz.utc)
