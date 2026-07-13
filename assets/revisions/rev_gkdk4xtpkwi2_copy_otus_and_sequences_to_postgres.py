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

alembic_down_revision = "5de38ebeaa78"
virtool_down_revision = None

# ``5de38ebeaa78`` adds ``legacy_sequences.isolate_id``/``segment`` and the
# ``legacy_otus.reference_id`` index on top of ``8bbc31ae5a8a`` (create otus and
# sequences tables), so requiring it guarantees the destination tables and every
# promoted column exist before this runs.
required_alembic_revision = "5de38ebeaa78"


async def upgrade(ctx: MigrationContext) -> None:
    """Copy the Mongo ``otus`` and ``sequences`` collections into Postgres."""
    await copy_otus_and_sequences_to_postgres(ctx)
