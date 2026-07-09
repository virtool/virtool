"""backfill sample uploads to postgres

Revision ID: n03aryu6frku
Date: 2026-07-08 22:26:30.163459

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.samples.migration import backfill_sample_uploads_to_postgres

logger = get_logger("migration")

# Revision identifiers.
name = "backfill sample uploads to postgres"
created_at = arrow.get("2026-07-08 22:26:30.163459")
revision_id = "n03aryu6frku"

alembic_down_revision = "1ffbe2dcb108"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
#
# ``1ffbe2dcb108`` creates the ``sample_uploads`` table. Chaining off it as the
# alembic down revision already guarantees it is applied before this runs.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill the sample-to-uploads membership into ``sample_uploads``.

    The implementation lives in :func:`backfill_sample_uploads_to_postgres`.
    """
    await backfill_sample_uploads_to_postgres(ctx)
