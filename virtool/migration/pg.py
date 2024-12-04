import sys
from datetime import datetime

import arrow
from sqlalchemy import Column, DateTime, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.migration.cls import AppliedRevision
from virtool.pg.base import Base

REQUIRED_VIRTOOL_REVISION = "wlh6h0hb1tm0"

logger = get_logger("migration")


class SQLRevision(Base):
    """Describes an applied data revision."""

    __tablename__ = "revisions"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    revision = Column(String, unique=True)
    created_at = Column(DateTime, nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False)


async def check_revision_applied(pg: AsyncEngine, revision: str) -> bool:
    """Check if a data revision has been applied.

    :param pg: the SQLAlchemy database engine
    :param revision: the revision id
    :return: ``True`` if the revision has been applied, ``False`` otherwise

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).where(SQLRevision.revision == revision),
        )

        return result.scalars().first() is not None


async def list_applied_revisions(pg: AsyncEngine) -> list[AppliedRevision]:
    """List all applied data revisions.

    :param pg: the SQLAlchemy database engine
    :return: a list of applied revisions

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.applied_at),
        )

        return [
            AppliedRevision(
                id=revision.id,
                applied_at=arrow.get(revision.applied_at).floor("second").naive,
                name=revision.name,
                revision=revision.revision,
                created_at=revision.created_at,
            )
            for revision in result.scalars()
        ]


async def fetch_last_applied_revision(pg: AsyncEngine) -> AppliedRevision | None:
    """Fetch the last applied data revision.

    Returns `None` if no revisions have been applied yet.

    :param pg: the SQLAlchemy database engine
    :return: the last applied revision or `None`
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.id.desc()).limit(1),
        )

        if result is None:
            return None

        revision = result.scalars().first()

        return (
            AppliedRevision(
                id=revision.id,
                applied_at=arrow.get(revision.applied_at).floor("second").naive,
                created_at=revision.created_at,
                name=revision.name,
                revision=revision.revision,
            )
            if revision
            else None
        )


async def check_data_revision_version(pg: AsyncEngine):
    """Check if the required MongoDB revision has been applied.

    Log a critical error and exit if the required revision has not been applied.

    :param pg: the application database object
    """
    log = logger.bind(revision=REQUIRED_VIRTOOL_REVISION)

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).where(
                SQLRevision.revision == REQUIRED_VIRTOOL_REVISION,
            ),
        )

        if result.first():
            log.info("found required revision")
            return

    log.critical("The required revision has not been applied")
    sys.exit(1)
