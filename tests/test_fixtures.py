import datetime

import pytest

from tests.fixtures.snapshot_date import validate_time


def test_time_not_recent_iso_string(snapshot_recent):
    timestamp = "2020/09/26"
    assert validate_time(timestamp) == snapshot_recent


def test_time_recent_iso_string(snapshot_recent):
    timestamp = datetime.datetime.utcnow().isoformat()
    assert validate_time(timestamp) == snapshot_recent


def test_time_not_iso_string(snapshot_recent):
    timestamp = "foobar"
    with pytest.raises(ValueError) as exc_info:
        validate_time(timestamp)
        assert exc_info == snapshot_recent


def test_time_recent_datetime(snapshot_recent):
    timestamp = datetime.datetime.utcnow()
    assert validate_time(timestamp) == snapshot_recent


def test_time_not_recent_datetime(snapshot_recent):
    timestamp = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
    assert validate_time(timestamp) == snapshot_recent


def test_time_fail(snapshot_recent):
    timestamp = 1234
    with pytest.raises(TypeError) as exc_info:
        validate_time(timestamp)
        assert exc_info == snapshot_recent


def test_time(snapshot_recent):
    assert {
        "id": 1,
        "active": True,
        "color": "red",
        "message": "Administrative instance message",
        "created_at": "2021-11-24T19:40:03.320000Z",
        "updated_at": "2021-11-24T19:40:03.320000Z",
    } == snapshot_recent
