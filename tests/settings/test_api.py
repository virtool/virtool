from http import HTTPStatus

from syrupy import SnapshotAssertion

from tests.fixtures.client import JobClientSpawner


async def test_get(
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    test_settings,
):
    """Test that the jobs API serves the complete application settings."""
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/settings")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot
