from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.data.domain import DataLayerDomain
from virtool.health.models import Readiness, ReadinessChecks
from virtool.mongo.core import Mongo

logger = get_logger("health")


class HealthData(DataLayerDomain):
    name = "health"

    def __init__(self, mongo: Mongo, pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def check_readiness(self) -> Readiness:
        """Check connectivity to the data backends.

        Each backend is pinged independently so that a failure of one does not mask
        the status of the other.

        :return: the readiness of the instance and a per-backend breakdown
        """
        checks = ReadinessChecks(
            mongodb=await self._check_mongo(),
            postgres=await self._check_postgres(),
        )

        return Readiness(ready=checks.mongodb and checks.postgres, checks=checks)

    async def _check_mongo(self) -> bool:
        try:
            await self._mongo.motor_database.command("ping")
        except Exception:
            logger.exception("mongodb readiness check failed")
            return False

        return True

    async def _check_postgres(self) -> bool:
        try:
            async with AsyncSession(self._pg) as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            logger.exception("postgres readiness check failed")
            return False

        return True
