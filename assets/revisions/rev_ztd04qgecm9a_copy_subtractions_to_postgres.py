"""Copy subtractions to postgres.

Revision ID: ztd04qgecm9a
Date: 2026-06-04 14:58:07.137267
"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.subtractions.migration import copy_subtractions_to_postgres

logger = get_logger("migration")

# Revision identifiers.
name = "copy subtractions to postgres"
created_at = arrow.get("2026-06-04 14:58:07.137267")
revision_id = "ztd04qgecm9a"

alembic_down_revision = "f95b556b3adc"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
#
# ``895d6315a838`` adds ``subtraction_files.subtraction_id`` and depends on
# ``f4624eb353b7`` (create subtractions table), so requiring it guarantees both
# the destination table and the file foreign-key column exist before this runs.
required_alembic_revision = "895d6315a838"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``subtraction`` document into Postgres.

    The implementation lives in :func:`copy_subtractions_to_postgres` so the later
    re-backfill revision can reuse the same idempotent copy.
    """
    await copy_subtractions_to_postgres(ctx)
