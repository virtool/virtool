import pytz
import pytest
import datetime


@pytest.fixture
def static_time():
    return datetime.datetime(2017, 10, 6, 20, 0, 0, tzinfo=datetime.timezone.utc)
