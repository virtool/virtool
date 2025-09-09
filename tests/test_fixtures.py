import datetime

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from tests.fixtures.snapshot_date import validate_time
from virtool.authorization.client import AuthorizationClient
from virtool.mongo.core import Mongo
from virtool.redis import Redis


def test_time_not_recent_iso_string(snapshot_recent: SnapshotAssertion):
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
    assert snapshot_recent == {
        "data": {
            "id": 1,
            "active": True,
            "color": "red",
            "message": "Administrative instance message",
            "created_at": "2021-11-24T19:40:03.320000Z",
            "updated_at": "2021-11-24T19:40:03.320000Z",
        },
    }


async def test_data_and_client_databases(
    authorization_client: AuthorizationClient,
    mongo: Mongo,
    pg: AsyncEngine,
    redis: Redis,
    spawn_client: ClientSpawner,
):
    """Test that data layer, database, and client fixtures refer to the same clients."""
    client = await spawn_client()

    assert authorization_client is client.app["authorization"]
    assert mongo is client.app["mongo"]
    assert pg is client.app["pg"]
    assert redis is client.app["redis"]
