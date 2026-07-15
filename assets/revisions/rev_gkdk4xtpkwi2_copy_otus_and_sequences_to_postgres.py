"""Copy Mongo OTUs and sequences to Postgres.

Backfills every existing ``otus`` and ``sequences`` document into the
``legacy_otus`` and ``legacy_sequences`` tables before OTU and sequence
mutations begin dual-writing to Postgres, so both stores are consistent ahead of
the read cutover.

The copy is idempotent: rows already present in Postgres (by ``id``, which is the
Mongo ``_id``) are skipped and every insert uses ``ON CONFLICT (id) DO NOTHING``,
and each document is committed individually so an interrupted run can be re-run
from where it stopped.

Revision ID: gkdk4xtpkwi2
Date: 2026-07-10 23:45:44.567131

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import copy_otus_and_sequences_to_postgres

# Revision identifiers.
name = "copy otus and sequences to postgres"
created_at = arrow.get("2026-07-10 23:45:44.567131")
revision_id = "gkdk4xtpkwi2"

alembic_down_revision = "c6fcaf6c86ad"
virtool_down_revision = None

# ``c6fcaf6c86ad`` adds ``legacy_otus.last_indexed_version`` on top of the earlier
# revisions that create the ``otus``/``sequences`` tables and their other promoted
# columns, so requiring it guarantees the destination tables and *every* promoted
# column -- ``last_indexed_version`` included -- exist before this copy runs
# ``otu_row_values``. This must run after ``c6fcaf6c86ad`` for that reason: the copy
# writes the column, so a chain that ran it before the column existed would fail with
# an undefined-column error on the first OTU.
required_alembic_revision = "c6fcaf6c86ad"


async def upgrade(ctx: MigrationContext) -> None:
    """Copy the Mongo ``otus`` and ``sequences`` collections into Postgres."""
    await copy_otus_and_sequences_to_postgres(ctx)
