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
    * Every revision not yet recorded as applied is applied, in dependency order,
      so a revision that was missed in the past is filled in rather than skipped.

    :param config: the configuration values for migration
    """
    os.environ["SQLALCHEMY_URL"] = get_sqlalchemy_url(
        config.pg_options
    ).render_as_string(hide_password=False)

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

    applied_revisions = await list_applied_revisions(ctx.pg)
    applied_revision_ids = {revision.revision for revision in applied_revisions}

    if applied_revisions:
        logger.info("Found applied revisions", count=len(applied_revisions))
    else:
        logger.info("No revisions have been applied yet")

    # Apply every revision that has not been recorded as applied, iterating in
    # dependency order.
    #
    # We decide revision-by-revision against the set of applied revision ids
    # rather than scanning forward from a single "last applied" position. A
    # position-based scan assumes every revision ordered before the latest
    # record was applied, which silently skips any earlier revision that was
    # never run -- for example when a past, buggy version applied revisions out
    # of order. Checking each revision guarantees a missed one is filled in, and
    # the dependency-ordered iteration guarantees it is applied in the correct
    # order relative to the revisions around it.
    for revision in all_revisions:
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

    The `name` and `revision` columns were originally length-limited. Existing
    databases are widened here because `CREATE TABLE IF NOT EXISTS` will not alter a
    table that already exists.

    :param pg: the PostgreSQL database connection
    """
    async with AsyncSession(pg) as session, session.begin():
        await session.execute(
            text(
                """
                    CREATE TABLE IF NOT EXISTS revisions (
                        id SERIAL PRIMARY KEY,
                        name varchar NOT NULL,
                        revision varchar NOT NULL,
                        created_at timestamp without time zone NOT NULL,
                        applied_at timestamp without time zone NOT NULL
                    )
                    """,
            ),
        )

        await session.execute(
            text("ALTER TABLE revisions ALTER COLUMN name TYPE varchar"),
        )

        await session.execute(
            text("ALTER TABLE revisions ALTER COLUMN revision TYPE varchar"),
        )
