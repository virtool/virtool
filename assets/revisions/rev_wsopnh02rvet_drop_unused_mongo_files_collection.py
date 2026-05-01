"""Drop the unused MongoDB ``files`` collection.

Uploads have been managed in PostgreSQL via ``SQLUpload`` for some time, and
the matching ``Mongo.files`` binding has been removed. This migration drops the
collection so old deployments don't keep an empty ``files`` collection around.

Idempotent: ``drop_collection`` is a no-op if the collection doesn't exist.

Revision ID: wsopnh02rvet
Date: 2026-05-01 17:42:56.029278

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

name = "drop unused mongo files collection"
created_at = arrow.get("2026-05-01 17:42:56.029278")
revision_id = "wsopnh02rvet"

alembic_down_revision = None
virtool_down_revision = "3g8rzbqj6k69"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.drop_collection("files")
    logger.info("dropped unused mongo files collection")
