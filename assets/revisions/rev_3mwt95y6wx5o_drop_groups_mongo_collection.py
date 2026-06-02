"""Drop the dead MongoDB ``groups`` collection.

The ``groups`` collection was superseded by the ``groups`` PostgreSQL table and
Virtool no longer reads or writes it. Its ``Mongo`` binding was already removed,
so nothing references the collection anymore.

This migration drops it so old deployments don't keep an empty collection
around.

Idempotent: ``drop_collection`` is a no-op if the collection doesn't exist.

Revision ID: 3mwt95y6wx5o
Date: 2026-06-02 18:57:24.826896

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "drop groups mongo collection"
created_at = arrow.get("2026-06-02 18:57:24.826896")
revision_id = "3mwt95y6wx5o"

alembic_down_revision = None
virtool_down_revision = "vm9nfmtwgrv9"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.drop_collection("groups")

    logger.info("dropped dead groups mongo collection")
