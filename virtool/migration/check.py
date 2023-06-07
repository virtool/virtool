import sys
from logging import getLogger
from pprint import pprint

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.migration.model import SQLRevision

REQUIRED_VIRTOOL_REVISION = "1zg28cpib2uj"

logger = getLogger("migration")


async def check_data_revision_version(pg: AsyncEngine):
    """
    Check if the required MongoDB revision has been applied.

    Log a fatal error and exit if the required revision has not been applied.

    :param pg: the application database object
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).where(SQLRevision.revision == REQUIRED_VIRTOOL_REVISION)
        )

        if result.first():
            logger.info("Found required revision id=%s", REQUIRED_VIRTOOL_REVISION)
            return

    logger.critical(
        "The required revision has not been applied id=%s",
        REQUIRED_VIRTOOL_REVISION,
    )

    sys.exit(1)
