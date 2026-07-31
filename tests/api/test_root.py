from syrupy.assertion import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import JobClientSpawner
from virtool.config import get_config_from_app
from virtool.fake.next import DataFaker


class TestGet:
    """Test the root request handler at /, served by the jobs API."""

    async def test_no_users(
        self,
        spawn_job_client: JobClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test when no users exist (first_user should be True)."""
        client = await spawn_job_client()

        resp = await client.get("/")
        body = await resp.json()

        assert body["first_user"] is True
        assert body["version"] == client.app["version"]
        assert body == snapshot(matcher=path_type({"version": (str,)}))

    async def test_has_users(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test when users exist (first_user should be False)."""
        await fake.users.create()

        client = await spawn_job_client()

        resp = await client.get("/")
        body = await resp.json()

        assert body["first_user"] is False
        assert body["version"] == client.app["version"]
        assert body == snapshot(matcher=path_type({"version": (str,)}))

    async def test_dev_mode(
        self,
        spawn_job_client: JobClientSpawner,
        snapshot: SnapshotAssertion,
    ):
        """Test dev mode flag is set correctly."""
        client = await spawn_job_client()
        get_config_from_app(client.app).dev = True

        resp = await client.get("/")
        body = await resp.json()

        assert body == snapshot(matcher=path_type({"version": (str,)}))
        assert body["version"] == client.app["version"]
