"""Re-backfill Mongo subtractions to Postgres.

A repeat of the ``ztd04qgecm9a`` backfill. That revision copied the Mongo
``subtraction`` collection into Postgres before subtraction mutations began
dual-writing to Postgres. Subtractions created or modified between the original
backfill and the dual-write rollout were never copied, so this revision re-runs
the same idempotent copy to converge those environments.

Because ``ztd04qgecm9a`` is already recorded as applied, it cannot be re-run
under its own id. This new revision re-runs the shared backfill.

Idempotent: rows already present in Postgres (by ``legacy_id``) are skipped and
the insert uses ``ON CONFLICT (legacy_id) DO NOTHING``, so this is a near no-op
on environments that are already current.

Revision ID: eta57bpbxmn1
Date: 2026-06-04 22:53:03.819611

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.subtractions.migration import copy_subtractions_to_postgres

logger = get_logger("migration")

# Revision identifiers.
name = "re-backfill subtractions to postgres"
created_at = arrow.get("2026-06-04 22:53:03.819611")
revision_id = "eta57bpbxmn1"

alembic_down_revision = "d12be6ff40c1"
virtool_down_revision = None

# ``895d6315a838`` adds ``subtraction_files.subtraction_id`` and depends on
# ``f4624eb353b7`` (create subtractions table), so requiring it guarantees both
# the destination table and the file foreign-key column exist before this runs.
required_alembic_revision = "895d6315a838"


async def upgrade(ctx: MigrationContext) -> None:
    """Re-run the idempotent Mongo to Postgres subtraction backfill."""
    await copy_subtractions_to_postgres(ctx)
