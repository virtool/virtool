"""Copy samples to postgres.

Revision ID: 4wxjh2cjere5
Date: 2026-07-03 22:35:21.451569

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.samples.migration import copy_samples_to_postgres

logger = get_logger("migration")

# Revision identifiers.
name = "copy samples to postgres"
created_at = arrow.get("2026-07-03 22:35:21.451569")
revision_id = "4wxjh2cjere5"

alembic_down_revision = None
virtool_down_revision = "bfzcj3gxn2dd"

# Change this if an Alembic revision is required to run this migration.
#
# ``edacc4a083f1`` creates ``legacy_samples`` and the ``legacy_sample_labels`` and
# ``legacy_sample_subtractions`` join tables, so requiring it guarantees every
# destination table exists before this runs.
required_alembic_revision = "edacc4a083f1"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``samples`` document into Postgres.

    The implementation lives in :func:`copy_samples_to_postgres`.
    """
    await copy_samples_to_postgres(ctx)
