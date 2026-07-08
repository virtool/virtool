"""Copy references to postgres.

Revision ID: t4u44jre75a0
Date: 2026-07-06 21:57:50.570636

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.references.migration import copy_references_to_postgres

logger = get_logger("migration")

# Revision identifiers.
name = "copy references to postgres"
created_at = arrow.get("2026-07-06 21:57:50.570636")
revision_id = "t4u44jre75a0"

alembic_down_revision = None
virtool_down_revision = "b4qhmbisvbn3"

# Change this if an Alembic revision is required to run this migration.
#
# ``fe83de8410d3`` is the head of the reference schema chain: it makes
# ``legacy_references.user_id`` not-null and drops ``created_at`` from the rights
# tables, on top of ``a73a2668403f`` (create the three tables) and
# ``425ac8573f1c`` (drop ``remove`` from the rights tables). Requiring it
# guarantees every destination table exists in its final shape before this runs.
required_alembic_revision = "fe83de8410d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``references`` document into Postgres.

    The implementation lives in :func:`copy_references_to_postgres`.
    """
    await copy_references_to_postgres(ctx)
