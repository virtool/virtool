from http import HTTPStatus

from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner


async def test_get(
    snapshot: SnapshotAssertion, spawn_client: ClientSpawner, test_settings
):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/settings")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


async def test_update(
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    test_settings,
):
    client = await spawn_client(administrator=True, authenticated=True)

    resp = await client.patch(
        "/settings",
        {"enable_api": False, "enable_sentry": False, "minimum_password_length": 10},
    )

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot
