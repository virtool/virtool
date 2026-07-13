"""Record each sequence's position within its OTU.

Reads every OTU's sequences back in Mongo's natural order -- the order
``virtool.otus.db.join`` has always returned them in, and therefore the order every
stored history diff was computed against -- and counts them off into
``legacy_sequences.position``.

Without it a joined OTU rebuilt from Postgres can present an isolate's sequences in
a different order than Mongo did, and the ``dictdiffer`` diffs that address them by
list index silently patch the wrong sequence.

The backfill is authoritative, not skip-existing, so it also repairs rows the
dual-write mis-numbered before this revision ran. It is idempotent: a second run
reads the same order and writes the same numbers.

Revision ID: 381mcji9pkiw
Date: 2026-07-13 18:50:31.446116

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import backfill_sequence_positions

# Revision identifiers.
name = "backfill sequence positions"
created_at = arrow.get("2026-07-13 18:50:31.446116")
revision_id = "381mcji9pkiw"

alembic_down_revision = "f8aa696aa0d3"
virtool_down_revision = None

# ``f8aa696aa0d3`` adds the ``legacy_sequences.position`` column this revision fills.
required_alembic_revision = "f8aa696aa0d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Assign every sequence row its position within its OTU."""
    await backfill_sequence_positions(ctx)
