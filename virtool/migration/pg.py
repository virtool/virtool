from typing import Optional

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.migration.cls import AppliedRevision
from virtool.migration.model import SQLRevision


async def check_revision_applied(pg: AsyncEngine, revision: str) -> bool:
    """
    Check if a data revision has been applied.

    :param pg: the SQLAlchemy database engine
    :param revision: the revision id
    :return: ``True`` if the revision has been applied, ``False`` otherwise

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).where(SQLRevision.revision == revision)
        )

        return result.scalars().first() is not None


async def list_applied_revisions(pg: AsyncEngine) -> list[AppliedRevision]:
    """
    List all applied data revisions.

    :param pg: the SQLAlchemy database engine
    :return: a list of applied revisions

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.applied_at)
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


async def list_applied_revision_ids(pg: AsyncEngine) -> list[str]:
    """
    List all applied data revision ids.

    :param pg: the SQLAlchemy database engine
    :return: a list of applied revision ids

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.applied_at)
        )

        return [revision.revision for revision in result.scalars()]


async def fetch_last_applied_revision(
    pg: AsyncEngine,
) -> Optional[AppliedRevision]:
    """
    Fetch the last applied data revision.

    Returns `None` if no revisions have been applied yet.

    :param pg: the SQLAlchemy database engine
    :return: the last applied revision or `None`
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.applied_at.desc()).limit(1)
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
