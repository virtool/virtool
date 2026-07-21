from pytest_mock import MockerFixture
from sqlalchemy.exc import OperationalError

from virtool.data.layer import DataLayer


class TestCheckReadiness:
    """Test ``HealthData.check_readiness``."""

    async def test_ready(self, data_layer: DataLayer):
        """A reachable backend yields a ready result."""
        readiness = await data_layer.health.check_readiness()

        assert readiness.ready is True
        assert readiness.checks.postgres is True

    async def test_postgres_unavailable(
        self,
        data_layer: DataLayer,
        mocker: MockerFixture,
    ):
        """An unreachable PostgreSQL marks the check failed and overall not ready."""
        mocker.patch(
            "virtool.health.data.AsyncSession",
            side_effect=OperationalError(
                "SELECT 1", None, Exception("connection refused")
            ),
        )

        readiness = await data_layer.health.check_readiness()

        assert readiness.ready is False
        assert readiness.checks.postgres is False
