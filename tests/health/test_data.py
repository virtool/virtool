from pymongo.errors import ServerSelectionTimeoutError
from pytest_mock import MockerFixture
from sqlalchemy.exc import OperationalError

from virtool.data.layer import DataLayer


class TestCheckReadiness:
    """Test ``HealthData.check_readiness``."""

    async def test_ready(self, data_layer: DataLayer):
        """Both backends reachable yields a ready result."""
        readiness = await data_layer.health.check_readiness()

        assert readiness.ready is True
        assert readiness.checks.mongodb is True
        assert readiness.checks.postgres is True

    async def test_mongo_unavailable(
        self,
        data_layer: DataLayer,
        mocker: MockerFixture,
    ):
        """An unreachable MongoDB marks only that check failed and overall not ready."""
        motor_database = data_layer.health._mongo.motor_database
        real_command = motor_database.command

        async def fail_ping(command, *args, **kwargs):
            if command == "ping":
                raise ServerSelectionTimeoutError("connection refused")
            return await real_command(command, *args, **kwargs)

        mocker.patch.object(motor_database, "command", side_effect=fail_ping)

        readiness = await data_layer.health.check_readiness()

        assert readiness.ready is False
        assert readiness.checks.mongodb is False
        assert readiness.checks.postgres is True

    async def test_postgres_unavailable(
        self,
        data_layer: DataLayer,
        mocker: MockerFixture,
    ):
        """An unreachable PostgreSQL marks only that check failed and overall not ready."""
        mocker.patch(
            "virtool.health.data.AsyncSession",
            side_effect=OperationalError(
                "SELECT 1", None, Exception("connection refused")
            ),
        )

        readiness = await data_layer.health.check_readiness()

        assert readiness.ready is False
        assert readiness.checks.mongodb is True
        assert readiness.checks.postgres is False
