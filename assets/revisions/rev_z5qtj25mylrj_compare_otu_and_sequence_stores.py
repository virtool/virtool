"""Compare the Mongo and Postgres OTU and sequence stores.

Gates the OTU and sequence read cutover. Runs after the backfill has copied every
``otus`` and ``sequences`` document into Postgres and the application is
dual-writing, and raises if the two stores disagree about any document, so reads
never move to a Postgres that has silently fallen behind Mongo.

The check is read-only and re-runnable: it mutates neither store and reaches the
same verdict on unchanged stores.

Revision ID: z5qtj25mylrj
Date: 2026-07-13 16:23:17.861824

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import compare_otu_and_sequence_stores

# Revision identifiers.
name = "compare otu and sequence stores"
created_at = arrow.get("2026-07-13 16:23:17.861824")
revision_id = "z5qtj25mylrj"

alembic_down_revision = None
virtool_down_revision = "gkdk4xtpkwi2"

# ``5de38ebeaa78`` adds ``legacy_sequences.isolate_id``/``segment`` and the
# ``legacy_otus.reference_id`` index, so requiring it guarantees every compared
# column exists.
required_alembic_revision = "5de38ebeaa78"


async def upgrade(ctx: MigrationContext) -> None:
    """Raise if the Mongo and Postgres OTU and sequence stores have drifted."""
    await compare_otu_and_sequence_stores(ctx)
