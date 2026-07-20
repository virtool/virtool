"""Backfill ``legacy_history.index_id`` from the legacy Mongo ``index`` string.

Runs after ``index_id`` is added to ``legacy_history`` and after the ``indexes``
table has been backfilled, so every built change's ``index`` string resolves to an
``indexes`` row. Idempotent: only rows whose ``index_id`` is still ``NULL`` are
touched, so an interrupted run resumes and a completed run is a no-op. Unbuilt
changes (``index IS NULL``) are left with a ``NULL`` ``index_id`` and never raise; a
non-null ``index`` that fails to resolve does.

Revision ID: x7lwnf9zk6mt
Date: 2026-07-17 23:57:26.334436

"""

import arrow

from virtool.history.migration import backfill_history_index_ids
from virtool.migration import MigrationContext

# Revision identifiers.
name = "backfill history index ids to integers"
created_at = arrow.get("2026-07-17 23:57:26.334436")
revision_id = "x7lwnf9zk6mt"

alembic_down_revision = "c3741294977e"
virtool_down_revision = None

# ``c3741294977e`` adds the ``index_id`` column this backfill writes, so requiring it
# guarantees the column exists before the update runs.
required_alembic_revision = "c3741294977e"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill ``legacy_history.index_id`` from the legacy ``index`` string."""
    await backfill_history_index_ids(ctx)
