import asyncio
import os
from logging import getLogger
from pathlib import Path

import alembic.command
import alembic.config
import arrow
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.config.cls import MigrationConfig
from virtool.migration.cls import RevisionSource, GenericRevision
from virtool.migration.ctx import MigrationContext, create_migration_context
from virtool.migration.pg import (
    fetch_last_applied_revision,
    SQLRevision,
    list_applied_revisions,
)
from virtool.migration.show import load_all_revisions

logger = getLogger("migration")


async def apply(config: MigrationConfig):
    """
    Apply revisions up to the most recent revision provided by the Virtool release.

    The following safety measures are taken:
    * Revisions that have already been successfully applied will not be reapplied.
    * When a revision fails to apply, the entire migration process will stop.
    * Revisions will start applied after the last successfully applied revision.

    :param config: the configuration values for migration
    """
    os.environ["SQLALCHEMY_URL"] = config.postgres_connection_string

    all_revisions = load_all_revisions()

    for revision in all_revisions:
        logger.info(
            "Loaded revision source='%s' id='%s' name='%s'",
            revision.source.value,
            revision.id,
            revision.name,
        )

    ctx = await create_migration_context(config)

    last_applied_revision = await fetch_last_applied_revision(ctx.pg)

    if last_applied_revision:
        logger.info(
            "Last applied revision revision='%s' name=%s",
            last_applied_revision.revision,
            last_applied_revision.name,
        )
    else:
        logger.info("No revisions have been applied yet")

    applied_revision_ids = {
        revision.revision for revision in await list_applied_revisions(ctx.pg)
    }

    start_applying = last_applied_revision is None

    for revision in all_revisions:
        if not start_applying:
            if revision.id == last_applied_revision.revision:
                start_applying = True

            continue

        logger.info("Checking revision id='%s' name=%s", revision.id, revision.name)

        # This is necessary because buggy versions of the migration may have applied
        # revisions in the wrong order.
        if revision.id in applied_revision_ids:
            logger.info(
                "Revision is already applied id='%s' name=%s",
                revision.id,
                revision.name,
            )

            continue

        await apply_one_revision(ctx, revision)

    os.environ["SQLALCHEMY_URL"] = ""

    logger.info("Migration complete")


async def apply_one_revision(ctx: MigrationContext, revision: GenericRevision):
    """
    Apply a single revision to Virtool data sources.

    The revision can be either a Virtool revision or an Alembic revision. Alembic
    revisions will be applied using the Alembic CLI. Virtool revisions will be applied
    using our custom migration system.

    :param ctx: the migration context
    :param revision: the revision to apply
    """
    logger.info("Applying revision '%s'", revision.id)

    if revision.source == RevisionSource.ALEMBIC:
        await apply_alembic(revision.id)
    else:
        await revision.upgrade(ctx)

    async with AsyncSession(ctx.pg) as session:
        session.add(
            SQLRevision(
                applied_at=arrow.utcnow().naive,
                created_at=revision.created_at,
                name=revision.name,
                revision=revision.id,
            )
        )

        await session.commit()

    logger.info("Applied revision id='%s'", revision.id)


async def apply_alembic(revision: str):
    """
    Apply the Alembic revision with the given id.

    """
    await asyncio.to_thread(
        alembic.command.upgrade,
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
        False,
        None,
    )
