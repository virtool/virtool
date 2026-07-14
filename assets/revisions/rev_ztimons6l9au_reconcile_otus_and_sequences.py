"""Rewrite every OTU and sequence row in Postgres from Mongo.

Repairs ``legacy_otus`` and ``legacy_sequences`` rows that drifted from the documents
they mirror while the application dual-wrote them. The OTU/sequence backfill inserts
with ``ON CONFLICT (id) DO NOTHING`` and so skips exactly the rows that need
repairing, which is why this pass upserts rather than re-running the backfill.

It rewrites ``data`` and every promoted column from the current Mongo document,
re-derives each sequence's ``position`` from Mongo's cursor order, and deletes rows
for documents Mongo no longer has. That repairs an OTU ``created_at`` stored with
microseconds Mongo never held, a ``last_indexed_version`` stamped into Mongo only,
and any row left behind by a history revert -- without needing to know which defect
applied to which row.

The write paths that produced the drift are fixed ahead of this, so the stores stay
converged once it has run.

Every dual-write commits Postgres before Mongo, so the application keeps rows visible
in Postgres that a Mongo read here cannot see yet. The pass never deletes a row a
concurrent writer could have created, never re-creates an OTU whose row vanished while
it ran, and never rewrites a row whose OTU version is ahead of the document it read.

The pass is idempotent and re-runnable: a second run reads the same documents in the
same order and writes the same values. It commits one OTU and its sequences at a
time, so an interrupted run keeps the rows already repaired.

Revision ID: ztimons6l9au
Date: 2026-07-13 23:10:42.247424

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import reconcile_otus_and_sequences

# Revision identifiers.
name = "reconcile otus and sequences"
created_at = arrow.get("2026-07-13 23:10:42.247424")
revision_id = "ztimons6l9au"

alembic_down_revision = None
virtool_down_revision = "381mcji9pkiw"

# ``f8aa696aa0d3`` adds ``legacy_sequences.position``, which this pass rewrites.
required_alembic_revision = "f8aa696aa0d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Rewrite every ``legacy_otus`` and ``legacy_sequences`` row from Mongo."""
    await reconcile_otus_and_sequences(ctx)
