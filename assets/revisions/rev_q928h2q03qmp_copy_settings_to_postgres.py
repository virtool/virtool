"""Copy settings to postgres.

Revision ID: q928h2q03qmp
Date: 2026-05-29 16:47:07.468716

"""

import arrow
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.settings.models import Settings
from virtool.settings.sql import SQLSettings

logger = get_logger("migration")

# Revision identifiers.
name = "copy settings to postgres"
created_at = arrow.get("2026-05-29 16:47:07.468716")
revision_id = "q928h2q03qmp"

alembic_down_revision = "d16de6e24788"
virtool_down_revision = None

# The settings table and its seeded singleton row must exist before backfilling.
required_alembic_revision = "d16de6e24788"


async def upgrade(ctx: MigrationContext) -> None:
    """Copy the legacy MongoDB ``settings`` document into the PostgreSQL row.

    Only runs while the PostgreSQL row is still at its seeded defaults, making the
    migration safe to re-run and ensuring it never clobbers settings that have
    already been changed in PostgreSQL. Fields dropped from the model
    (``hmm_slug``, ``sample_unique_names``) are ignored if present in MongoDB.

    Legacy documents may carry ``null`` for non-nullable fields (notably
    ``sample_group``). Such values are skipped so the seeded default stands
    rather than violating the column constraint.
    """
    mongo_settings = await ctx.mongo.settings.find_one({"_id": "settings"})

    if mongo_settings is None:
        logger.info("no mongodb settings document to backfill")
        return

    backfill = {
        field: mongo_settings[field]
        for field in Settings.__fields__
        if mongo_settings.get(field) is not None
    }

    if not backfill:
        logger.info("mongodb settings document had no fields to backfill")
        return

    async with AsyncSession(ctx.pg) as session:
        current = (
            await session.execute(select(SQLSettings).where(SQLSettings.id == 1))
        ).scalar()

        if current is None:
            logger.warning("settings row missing; skipping backfill")
            return

        current_values = {
            field: getattr(current, field) for field in Settings.__fields__
        }

        if current_values != Settings().dict():
            logger.info("postgres settings already customized; skipping backfill")
            return

        await session.execute(
            update(SQLSettings).where(SQLSettings.id == 1).values(**backfill),
        )
        await session.commit()

    logger.info("backfilled settings from mongodb", fields=sorted(backfill))
