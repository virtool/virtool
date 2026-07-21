import asyncio

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.data.domain import DataLayerDomain
from virtool.health.models import Readiness, ReadinessChecks

logger = get_logger("health")

CHECK_TIMEOUT = 5
"""The maximum time in seconds to wait for a single backend readiness check.

Bounds each probe so a hung connection fails fast and deterministically instead of
stalling the readiness response past an orchestrator's probe timeout.
"""


class HealthData(DataLayerDomain):
    name = "health"

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def check_readiness(self) -> Readiness:
        """Check connectivity to the data backends.

        :return: the readiness of the instance and a per-backend breakdown
        """
        checks = ReadinessChecks(
            postgres=await self._check_postgres(),
        )

        return Readiness(ready=checks.postgres, checks=checks)

    async def _check_postgres(self) -> bool:
        try:
            async with asyncio.timeout(CHECK_TIMEOUT):
                async with AsyncSession(self._pg) as session:
                    await session.execute(text("SELECT 1"))
        except (SQLAlchemyError, TimeoutError):
            logger.exception("postgres readiness check failed")
            return False

        return True
