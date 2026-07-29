from pytest_mock import MockerFixture

from tests.fixtures.client import (
    JobClientSpawner,
    TaskRunnerClientSpawner,
)
from virtool.health.models import Readiness, ReadinessChecks


class TestJobsServer:
    """The endpoints are also served, unauthenticated, by the jobs API server."""

    async def test_live(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client()

        resp = await client.get("/health/live")

        assert resp.status == 200
        assert await resp.json() == {"status": "alive"}

    async def test_ready(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client()

        resp = await client.get("/health/ready")

        assert resp.status == 200
        assert await resp.json() == {
            "ready": True,
            "checks": {"postgres": True},
        }

    async def test_not_ready(
        self,
        spawn_job_client: JobClientSpawner,
        mocker: MockerFixture,
    ):
        """Readiness returns 503 with the failing dependency surfaced in ``checks``."""
        client = await spawn_job_client()

        check_readiness = mocker.patch.object(
            client.app["data"].health,
            "check_readiness",
            new_callable=mocker.AsyncMock,
            return_value=Readiness(
                ready=False,
                checks=ReadinessChecks(postgres=False),
            ),
        )

        resp = await client.get("/health/ready")

        assert resp.status == 503
        assert await resp.json() == {
            "ready": False,
            "checks": {"postgres": False},
        }
        check_readiness.assert_awaited_once()


class TestTaskRunner:
    """The endpoints are also served, unauthenticated, by the task runner."""

    async def test_live(self, spawn_task_runner_client: TaskRunnerClientSpawner):
        client = await spawn_task_runner_client()

        resp = await client.get("/health/live")

        assert resp.status == 200
        assert await resp.json() == {"status": "alive"}

    async def test_ready(self, spawn_task_runner_client: TaskRunnerClientSpawner):
        client = await spawn_task_runner_client()

        resp = await client.get("/health/ready")

        assert resp.status == 200
        assert await resp.json() == {
            "ready": True,
            "checks": {"postgres": True},
        }
