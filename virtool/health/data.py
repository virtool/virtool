import asyncio

from pymongo.errors import PyMongoError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.data.domain import DataLayerDomain
from virtool.health.models import Readiness, ReadinessChecks
from virtool.mongo.core import Mongo

logger = get_logger("health")

CHECK_TIMEOUT = 5
"""The maximum time in seconds to wait for a single backend readiness check.

Bounds each probe so a hung connection fails fast and deterministically instead of
stalling the readiness response past an orchestrator's probe timeout.
"""


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
            async with asyncio.timeout(CHECK_TIMEOUT):
                await self._mongo.motor_database.command("ping")
        except (PyMongoError, TimeoutError):
            logger.exception("mongodb readiness check failed")
            return False

        return True

    async def _check_postgres(self) -> bool:
        try:
            async with asyncio.timeout(CHECK_TIMEOUT):
                async with AsyncSession(self._pg) as session:
                    await session.execute(text("SELECT 1"))
        except (SQLAlchemyError, TimeoutError):
            logger.exception("postgres readiness check failed")
            return False

        return True
