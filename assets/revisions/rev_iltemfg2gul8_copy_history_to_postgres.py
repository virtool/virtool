"""Copy history to postgres.

Revision ID: iltemfg2gul8
Date: 2026-07-02 16:12:31.701659

"""

import arrow
from structlog import get_logger

from virtool.history.migration import copy_history_to_postgres
from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "copy history to postgres"
created_at = arrow.get("2026-07-02 16:12:31.701659")
revision_id = "iltemfg2gul8"

alembic_down_revision = "95ca6fc2a5db"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
#
# ``adea254e2c31`` renames the ``legacy_history`` reference columns to their final
# names, and depends on ``743a03e550e0`` (create legacy_history table), so requiring
# it guarantees the destination table exists with the columns this backfill writes.
required_alembic_revision = "adea254e2c31"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``history`` document into Postgres.

    The implementation lives in :func:`copy_history_to_postgres` so the later
    re-backfill revision can reuse the same idempotent copy.
    """
    await copy_history_to_postgres(ctx)
