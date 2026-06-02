from pytest_mock import MockerFixture

from tests.fixtures.client import ClientSpawner
from virtool.health.models import Readiness, ReadinessChecks


class TestLiveness:
    """Test ``GET /health/live``."""

    async def test_ok(self, spawn_client: ClientSpawner):
        """Liveness returns 200 without authentication and checks no dependencies."""
        client = await spawn_client()

        resp = await client.get("/health/live")

        assert resp.status == 200
        assert await resp.json() == {"status": "alive"}


class TestReadiness:
    """Test ``GET /health/ready``."""

    async def test_ready(self, spawn_client: ClientSpawner):
        """Readiness returns 200 with both checks passing when backends are up."""
        client = await spawn_client()

        resp = await client.get("/health/ready")

        assert resp.status == 200
        assert await resp.json() == {
            "ready": True,
            "checks": {"mongodb": True, "postgres": True},
        }

    async def test_not_ready(
        self,
        spawn_client: ClientSpawner,
        mocker: MockerFixture,
    ):
        """Readiness returns 503 with the failing dependency surfaced in ``checks``."""
        client = await spawn_client()

        mocker.patch.object(
            client.app["data"].health,
            "check_readiness",
            return_value=Readiness(
                ready=False,
                checks=ReadinessChecks(mongodb=False, postgres=True),
            ),
        )

        resp = await client.get("/health/ready")

        assert resp.status == 503
        assert await resp.json() == {
            "ready": False,
            "checks": {"mongodb": False, "postgres": True},
        }
