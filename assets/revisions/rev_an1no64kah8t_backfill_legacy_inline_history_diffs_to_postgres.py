"""backfill legacy inline history diffs to postgres

Revision ID: an1no64kah8t
Date: 2026-06-06 00:18:17.917580

"""

import arrow

from virtool.history.migration import backfill_inline_history_diffs
from virtool.migration import MigrationContext

# Revision identifiers.
name = "backfill legacy inline history diffs to postgres"
created_at = arrow.get("2026-06-06 00:18:17.917580")
revision_id = "an1no64kah8t"

alembic_down_revision = "997cf9a66f10"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
#
# ``86d4e93bb0bd`` creates the ``history_diffs`` table this backfill writes into.
required_alembic_revision = "86d4e93bb0bd"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every legacy inline ``history`` diff into Postgres.

    The implementation lives in :func:`backfill_inline_history_diffs` so a later
    re-backfill revision can reuse the same idempotent copy.
    """
    await backfill_inline_history_diffs(ctx)
