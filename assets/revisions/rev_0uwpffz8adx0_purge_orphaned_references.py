"""Purge orphaned references.

Remove the OTU, sequence, index, and history data belonging to references whose
Mongo document was deleted without cascading to its children. These orphans were
never copied to Postgres, so the reference-id backfill (``xgqo66avrcdh``) cannot
resolve them; running this first lets that backfill stay a strict correctness
guard.

The implementation lives in :func:`purge_orphaned_references`.

Revision ID: 0uwpffz8adx0
Date: 2026-07-07 18:05:23.934964

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.references.migration import purge_orphaned_references

logger = get_logger("migration")

# Revision identifiers.
name = "purge orphaned references"
created_at = arrow.get("2026-07-07 18:05:23.934964")
revision_id = "0uwpffz8adx0"

alembic_down_revision = "91b32f49a8b2"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
#
# ``91b32f49a8b2`` adds the ``reference_id`` columns; this purge runs immediately
# after it and immediately before the ``xgqo66avrcdh`` backfill that fills them.
required_alembic_revision = "91b32f49a8b2"


async def upgrade(ctx: MigrationContext) -> None:
    """Purge OTU, sequence, index, and history data for deleted references.

    The implementation lives in :func:`purge_orphaned_references`.
    """
    await purge_orphaned_references(ctx)
