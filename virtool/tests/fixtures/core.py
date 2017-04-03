import pytest

from datetime import datetime, timedelta


ZERO = timedelta(0)


class UTC(datetime.tzinfo):

    def utcoffset(self, dt):
        return ZERO

    def tzname(self, dt):
        return "UTC"

    def dst(self, dt):
        return ZERO


@pytest.fixture
def static_time():
    dt = datetime(2017, 10, 6, 13, 0, 0, UTC())
    print(str(dt))
    return dt
