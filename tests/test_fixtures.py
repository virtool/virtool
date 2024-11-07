import datetime

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.fixtures.client import ClientSpawner
from tests.fixtures.snapshot_date import validate_time
from virtool.mongo.core import Mongo


def test_time_not_recent_iso_string(snapshot_recent):
    timestamp = "2020/09/26"
    assert validate_time(timestamp) == snapshot_recent


def test_time_recent_iso_string(snapshot_recent):
    timestamp = arrow.utcnow().naive.isoformat()
    assert validate_time(timestamp) == snapshot_recent


def test_time_not_iso_string(snapshot_recent):
    timestamp = "foobar"
    with pytest.raises(ValueError) as exc_info:
        validate_time(timestamp)
        assert exc_info == snapshot_recent


def test_time_recent_datetime(snapshot_recent):
    timestamp = arrow.utcnow().naive
    assert validate_time(timestamp) == snapshot_recent


def test_time_not_recent_datetime(snapshot_recent):
    timestamp = arrow.utcnow().naive - datetime.timedelta(minutes=1)
    assert validate_time(timestamp) == snapshot_recent


def test_time_fail(snapshot_recent):
    timestamp = 1234
    with pytest.raises(TypeError) as exc_info:
        validate_time(timestamp)
        assert exc_info == snapshot_recent


def test_nested_timestamps(snapshot_recent):
    assert {
        "data": {
            "id": 1,
            "active": True,
            "color": "red",
            "message": "Administrative instance message",
            "created_at": "2021-11-24T19:40:03.320000Z",
            "updated_at": "2021-11-24T19:40:03.320000Z",
        },
    } == snapshot_recent


async def test_data_and_client_databases(
    motor_database: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
):
    """Test that data layer, database, and client fixtures refer to the same clients."""
    client = await spawn_client()

    assert motor_database is client.mongo.motor_database
    assert pg is client.pg
