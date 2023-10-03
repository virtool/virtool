import datetime

import pytest

from tests.fixtures.snapshot_date import validate_time


def test_time_invalid():
    timestamp = "2020/09/26"
    with pytest.raises(ValueError):
        validate_time(timestamp)


def test_time_recent():
    timestamp = datetime.datetime.utcnow()
    assert validate_time(timestamp) == "approximately_now"


def test_time_not_recent():
    timestamp = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
    assert validate_time(timestamp) == "not_approximately_now"
