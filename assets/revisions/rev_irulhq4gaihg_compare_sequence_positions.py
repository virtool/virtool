"""Compare the Mongo and Postgres sequence ordering.

Gates the OTU and sequence read cutover on ordering, which
``compare otu and sequence stores`` cannot check: that revision compares a row
against the columns derived from a single Mongo document, but ``position`` orders a
sequence within its OTU and has to be checked an OTU at a time.

Runs after the position backfill and raises if Postgres would hand any OTU's
sequences back in a different order than Mongo does, so reads never move to a
Postgres that would make ``patch_to_version`` apply stored diffs to the wrong
sequence.

The check is read-only and re-runnable: it mutates neither store and reaches the
same verdict on unchanged stores.

Revision ID: irulhq4gaihg
Date: 2026-07-13 18:50:32.326408

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import compare_sequence_positions

# Revision identifiers.
name = "compare sequence positions"
created_at = arrow.get("2026-07-13 18:50:32.326408")
revision_id = "irulhq4gaihg"

alembic_down_revision = None
virtool_down_revision = "381mcji9pkiw"

# ``f8aa696aa0d3`` adds the ``legacy_sequences.position`` column this revision reads.
required_alembic_revision = "f8aa696aa0d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Raise if Postgres orders any OTU's sequences differently than Mongo."""
    await compare_sequence_positions(ctx)
