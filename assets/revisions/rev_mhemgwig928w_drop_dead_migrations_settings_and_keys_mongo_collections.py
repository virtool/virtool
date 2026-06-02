"""Drop the dead MongoDB ``migrations``, ``settings``, and ``keys`` collections.

The ``settings`` and ``keys`` collections have been migrated to PostgreSQL (see
the ``copy settings to postgres`` and ``copy api keys to postgres`` revisions),
and Virtool no longer reads or writes either one. The ``migrations`` collection
belonged to the legacy pre-Alembic migration system and is likewise unused. The
matching ``Mongo`` bindings have been removed, so nothing references these
collections anymore.

This migration drops all three so old deployments don't keep empty collections
around. It is ordered after the copy-to-postgres revisions, so their backfills
always complete before the source collections are dropped.

Idempotent: ``drop_collection`` is a no-op if a collection doesn't exist.

Revision ID: mhemgwig928w
Date: 2026-06-02 15:53:35.478562

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "drop dead migrations settings and keys mongo collections"
created_at = arrow.get("2026-06-02 15:53:35.478562")
revision_id = "mhemgwig928w"

alembic_down_revision = "7ea2f370163c"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    for collection_name in ("migrations", "settings", "keys"):
        await ctx.mongo.drop_collection(collection_name)

    logger.info("dropped dead mongo collections")
