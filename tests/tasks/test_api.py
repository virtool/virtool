from http import HTTPStatus

from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker


async def test_find(
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    """Test that a ``GET /tasks`` return a complete list of tasks."""
    client = await spawn_client(authenticated=True)

    await fake.tasks.create()
    await fake.tasks.create()
    await fake.tasks.create()

    resp = await client.get("/tasks")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot_recent


class TestGet:
    async def test_ok(
        self,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``GET /tasks/:task_id`` return the correct task document."""
        client = await spawn_client(authenticated=True)

        task = await fake.tasks.create()

        resp = await client.get(f"/tasks/{task.id}")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body.pop("id") == task.id
        assert body == snapshot_recent

    async def test_not_found(self, spawn_client: ClientSpawner):
        """Test that fetching a non-existent task returns a 404."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/tasks/99")

        assert resp.status == HTTPStatus.NOT_FOUND
