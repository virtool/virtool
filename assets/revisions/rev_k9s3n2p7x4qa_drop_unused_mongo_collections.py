"""Drop unused MongoDB collections.

The ``caches``, ``groups``, and ``sessions`` collections have been superseded
by other storage and are no longer read by Virtool.

Idempotent: ``drop_collection`` is a no-op if a collection doesn't exist.

Revision ID: k9s3n2p7x4qa
Date: 2026-05-01 12:16:51.963048

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

name = "drop unused mongo collections"
created_at = arrow.get("2026-05-01 12:16:51.963048")
revision_id = "k9s3n2p7x4qa"

alembic_down_revision = None
virtool_down_revision = "wsopnh02rvet"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    for collection_name in ("caches", "groups", "sessions"):
        await ctx.mongo.drop_collection(collection_name)

    logger.info("dropped unused mongo collections")
