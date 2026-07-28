from http import HTTPStatus

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.tasks.oas import UpdateTaskRequest


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
        """Test that the endpoint is not served by the public API."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/tasks/counts")

        assert resp.status == HTTPStatus.NOT_FOUND
