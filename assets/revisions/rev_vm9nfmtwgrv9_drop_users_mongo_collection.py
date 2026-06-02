"""Drop the dead MongoDB ``users`` collection.

Users have been migrated to PostgreSQL (``SQLUser``) and Virtool no longer reads
or writes the Mongo ``users`` collection. The last read (the
``users_primary_group`` sample-owner lookup) now queries Postgres, and the
``Mongo.users`` binding has been removed, so nothing references this collection
anymore.

This migration drops it so old deployments don't keep an empty collection
around.

Idempotent: ``drop_collection`` is a no-op if the collection doesn't exist.

Revision ID: vm9nfmtwgrv9
Date: 2026-06-02 18:50:25.805441

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "drop users mongo collection"
created_at = arrow.get("2026-06-02 18:50:25.805441")
revision_id = "vm9nfmtwgrv9"

alembic_down_revision = None
virtool_down_revision = "mhemgwig928w"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.drop_collection("users")

    logger.info("dropped dead users mongo collection")
