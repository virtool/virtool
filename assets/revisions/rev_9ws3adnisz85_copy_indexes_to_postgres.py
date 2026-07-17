"""Copy Mongo indexes to Postgres.

Backfills every existing ``indexes`` document into the ``indexes`` table now that
index mutations dual-write to Postgres, so both stores are consistent ahead of the
read cutover.

The copy is idempotent: rows already present in Postgres (by ``legacy_id``, which
is the Mongo ``_id``) are skipped and every insert uses ``ON CONFLICT (legacy_id)
DO NOTHING``, and each document is committed individually so an interrupted run can
be re-run from where it stopped.

Revision ID: 9ws3adnisz85
Date: 2026-07-17 18:18:14.064540

"""

import arrow

from virtool.indexes.migration import copy_indexes_to_postgres
from virtool.migration import MigrationContext

# Revision identifiers.
name = "copy indexes to postgres"
created_at = arrow.get("2026-07-17 18:18:14.064540")
revision_id = "9ws3adnisz85"

alembic_down_revision = "aaac048795ba"
virtool_down_revision = None

# ``aaac048795ba`` relaxes ``ck_indexes_job_or_task`` to ``<= 1`` so a legacy build
# whose job was deleted before the jobs migration can be copied with a ``NULL``
# ``job_id``; it also chains behind ``6ffca63a8b95``, which creates the ``indexes``
# table. Downgrading to it guarantees both the destination table and the relaxed
# constraint exist before the copy runs.
required_alembic_revision = "aaac048795ba"


async def upgrade(ctx: MigrationContext) -> None:
    """Copy the Mongo ``indexes`` collection into Postgres."""
    await copy_indexes_to_postgres(ctx)
