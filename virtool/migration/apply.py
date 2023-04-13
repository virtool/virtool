from logging import getLogger
from pathlib import Path
from typing import Optional

import arrow
from alembic.util import load_python_file
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.config.cls import MigrationConfig
from virtool.migration.cls import AppliedRevision, Revision
from virtool.migration.ctx import MigrationContext, create_migration_context
from virtool.migration.model import SQLRevision
from virtool.migration.utils import get_revisions_path

logger = getLogger("migration")


async def apply_to(
    config: MigrationConfig,
    revision_id: str = "latest",
):
    """
    Apply revisions up to a given revision_id, ``to``.

    Providing ``'latest'`` as for ``to`` will apply all required revisions up to latest.

    Applied revisions are recorded in the target database so already applied revisions
    are not reapplied in subsequent migrations.

    :param config: the configuration values for migration
    :param revision_id: the revision_id to update to or 'latest'
    """
    logger.info("Applying revisions up to '%s'", revision_id)

    ctx = create_migration_context(config)

    last_applied_revision = await fetch_last_applied_revision(ctx.pg)

    for revision in _load_revisions(get_revisions_path()):
        if last_applied_revision is None or (
            revision.created_at > last_applied_revision.created_at
        ):
            await apply_one_revision(ctx, revision)

        if revision_id != "latest" and revision.id == revision_id:
            break


async def apply_one_revision(ctx: MigrationContext, revision):
    """
    Apply a single revision to Virtool data sources.

    :param ctx: the migration context
    :param revision: the revision to apply
    """
    logger.info("Applying revision '%s'", revision.id)

    async with ctx.with_revision_context() as revision_ctx:
        await revision.upgrade(revision_ctx)

        await revision_ctx.pg.add(
            SQLRevision(
                applied_at=arrow.utcnow().naive,
                revision=revision.id,
            )
        )


def _load_revisions(revisions_path: Path) -> list[Revision]:
    """
    Load revision modules and sort by creation date.

    :param revisions_path: the path to the revisions directory
    :returns: a list of revisions sorted by creation date
    """
    revisions = []

    for module_path in revisions_path.iterdir():
        if module_path.suffix == ".py":
            module = load_python_file(str(module_path.parent), str(module_path.name))

            revisions.append(
                Revision(
                    id=getattr(module, "revision_id"),
                    created_at=arrow.get(getattr(module, "created_at"))
                    .floor("second")
                    .naive,
                    name=getattr(module, "name"),
                    upgrade=getattr(module, "upgrade"),
                )
            )

    revisions.sort(key=lambda r: r.created_at)

    logger.info("Found %s revisions", len(revisions))

    return revisions


async def fetch_last_applied_revision(
    pg: AsyncEngine,
) -> Optional[AppliedRevision]:
    """
    Pull the most recent revision applied to the MongoDB database.
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLRevision).order_by(SQLRevision.applied_at)
        )

        revision = await result.first()

        return (
            AppliedRevision(
                id=revision.id,
                applied_at=arrow.get(revision.applied_at).floor("second").naive,
                name=revision.name,
                revision=revision.revision,
            )
            if revision
            else None
        )
