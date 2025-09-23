from syrupy.assertion import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.config import get_config_from_app


class TestGet:
    """Test the root request handler at /."""

    async def test_no_users(
        self,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test when no users exist (first_user should be True)."""
        client = await spawn_client()

        resp = await client.get("/")
        body = await resp.json()

        assert body["first_user"] is True
        assert body["version"] == client.app["version"]
        assert body == snapshot(matcher=path_type({"version": (str,)}))

    async def test_has_users(
        self,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test when users exist (first_user should be False)."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/")
        body = await resp.json()

        assert body["first_user"] is False
        assert body["version"] == client.app["version"]
        assert body == snapshot(matcher=path_type({"version": (str,)}))

    async def test_dev_mode(
        self,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test dev mode flag is set correctly."""
        client = await spawn_client()
        get_config_from_app(client.app).dev = True

        resp = await client.get("/")
        body = await resp.json()

        assert body == snapshot(matcher=path_type({"version": (str,)}))
        assert body["version"] == client.app["version"]
