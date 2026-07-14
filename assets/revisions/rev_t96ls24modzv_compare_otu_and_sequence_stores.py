"""Compare the Mongo and Postgres OTU and sequence stores.

Gates the OTU and sequence read cutover. Runs after the reconciliation has rewritten
every ``legacy_otus`` and ``legacy_sequences`` row from Mongo, and raises if the two
stores still disagree, so reads never move to a Postgres that has silently fallen
behind Mongo.

The check asserts the read contract directly: every row is passed back through
``otu_document_from_row`` and ``sequence_document_from_row`` -- the functions ``join``
itself uses -- and the recovered document must equal the Mongo document. It also
checks the promoted columns, and that each OTU's sequences, ordered by ``position``,
come back in the order Mongo's cursor returns them.

The check is read-only and re-runnable: it mutates neither store and reaches the
same verdict on unchanged stores.

Revision ID: t96ls24modzv
Date: 2026-07-13 23:10:46.510454

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import compare_otu_and_sequence_stores

# Revision identifiers.
name = "compare otu and sequence stores"
created_at = arrow.get("2026-07-13 23:10:46.510454")
revision_id = "t96ls24modzv"

alembic_down_revision = None
virtool_down_revision = "yok1ouqta8nf"

# ``f8aa696aa0d3`` adds ``legacy_sequences.position``, which this check verifies.
required_alembic_revision = "f8aa696aa0d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Raise if the Mongo and Postgres OTU and sequence stores have drifted."""
    await compare_otu_and_sequence_stores(ctx)
