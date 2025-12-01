import asyncio
import os
from pathlib import Path

import alembic.command
import alembic.config
import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.config.cls import MigrationConfig
from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.ctx import MigrationContext, create_migration_context
from virtool.migration.pg import (
    SQLRevision,
    fetch_last_applied_revision,
    list_applied_revisions,
)
from virtool.migration.show import load_all_revisions
from virtool.pg.utils import get_sqlalchemy_url

logger = get_logger("migration")


async def apply(config: MigrationConfig) -> None:
    """Apply revisions up to the most recent revision provided by the Virtool release.

    The following safety measures are taken:
    * Revisions that have already been successfully applied will not be reapplied.
    * When a revision fails to apply, the entire migration process will stop.
    * Revisions will start applied after the last successfully applied revision.

    :param config: the configuration values for migration
    """
    os.environ["SQLALCHEMY_URL"] = get_sqlalchemy_url(config.postgres_connection_string)

    all_revisions = load_all_revisions()

    for revision in all_revisions:
        logger.info(
            "Loaded revision",
            id=revision.id,
            name=revision.name,
            source=revision.source.value,
        )

    ctx = await create_migration_context(config)

    await ensure_revisions_table(ctx.pg)

    last_applied_revision = await fetch_last_applied_revision(ctx.pg)

    if last_applied_revision:
        logger.info(
            "Found last applied revision",
            revision=last_applied_revision.revision,
            name=last_applied_revision.name,
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

        logger.info("Checking revision", id=revision.id, name=revision.name)

        # This is necessary because buggy versions of the migration may have applied
        # revisions in the wrong order.
        if revision.id in applied_revision_ids:
            logger.info(
                "Revision is already applied",
                id=revision.id,
                name=revision.name,
            )
            continue

        await apply_one_revision(ctx, revision)

    os.environ["SQLALCHEMY_URL"] = ""

    logger.info("Migration complete")


async def apply_one_revision(ctx: MigrationContext, revision: GenericRevision) -> None:
    """Apply a single revision to Virtool data sources.

    The revision can be either a Virtool revision or an Alembic revision. Alembic
    revisions will be applied using the Alembic CLI. Virtool revisions will be applied
    using our custom migration system.

    :param ctx: the migration context
    :param revision: the revision to apply
    """
    log = logger.bind(id=revision.id, name=revision.name)

    log.info("Applying revision")

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
            ),
        )

        await session.commit()

    log.info("Applied revision")


async def apply_alembic(revision: str) -> None:
    """Apply the Alembic revision with the given id."""
    await asyncio.to_thread(
        alembic.command.upgrade,
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
        False,
        None,
    )


async def ensure_revisions_table(pg: AsyncEngine) -> None:
    """Ensure that the `revisions` table exists in the database.

    :param pg: the PostgreSQL database connection
    """
    async with AsyncSession(pg) as session, session.begin():
        await session.execute(
            text(
                """
                    CREATE TABLE IF NOT EXISTS revisions (
                        id SERIAL PRIMARY KEY,
                        name varchar(64) NOT NULL,
                        revision varchar(18) NOT NULL,
                        created_at timestamp without time zone NOT NULL,
                        applied_at timestamp without time zone NOT NULL
                    )
                    """,
            ),
        )
