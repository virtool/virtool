from http import HTTPStatus

from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.tasks.oas import UpdateTaskRequest


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


class TestGetCounts:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that queued and running tasks are counted on the jobs API."""
        client = await spawn_job_client(authenticated=False)

        await fake.tasks.create()
        await fake.tasks.create()
        await fake.tasks.create()

        await data_layer.tasks.acquire("runner")

        resp = await client.get("/tasks/counts")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == {"queued": 2, "running": 1}

    async def test_empty(self, spawn_job_client: JobClientSpawner):
        """Test that counts are zero when there are no tasks."""
        client = await spawn_job_client(authenticated=False)

        resp = await client.get("/tasks/counts")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == {"queued": 0, "running": 0}

    async def test_excludes_terminal_tasks(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that completed and errored tasks are not counted."""
        client = await spawn_job_client(authenticated=False)

        completed = await fake.tasks.create()
        await data_layer.tasks.complete(completed.id)

        errored = await fake.tasks.create()
        await data_layer.tasks.update(errored.id, UpdateTaskRequest(error="boom"))

        await fake.tasks.create()

        resp = await client.get("/tasks/counts")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == {"queued": 1, "running": 0}

    async def test_not_on_public_api(self, spawn_client: ClientSpawner):
        """Test that the endpoint is not served by the public API.

        The public API has no ``/tasks/counts`` route, so the request falls
        through to ``/tasks/{task_id}`` and is rejected as a non-integer id.
        """
        client = await spawn_client(authenticated=True)

        resp = await client.get("/tasks/counts")

        assert resp.status == HTTPStatus.BAD_REQUEST
