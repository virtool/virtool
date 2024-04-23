import pytest

from tests.fixtures.client import ClientSpawner


async def test_get(snapshot, spawn_client: ClientSpawner, test_settings):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/settings")

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_update(snapshot, spawn_client: ClientSpawner, test_settings):
    client = await spawn_client(administrator=True, authenticated=True)

    resp = await client.patch(
        "/settings",
        {"enable_api": False, "enable_sentry": False, "minimum_password_length": 10},
    )

    assert resp.status == 200
    assert await resp.json() == snapshot
