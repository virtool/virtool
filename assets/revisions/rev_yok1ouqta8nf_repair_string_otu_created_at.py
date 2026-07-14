"""Rewrite a Mongo OTU ``created_at`` held as a string as the datetime it means.

Every OTU of a reference cloned before December 2022 holds its ``created_at`` as an
ISO string rather than a BSON date. The clone task read the timestamp from its task
context -- a JSONB column -- so the reference's creation datetime came back out of
Postgres as a string, and was written into each OTU document as one.

The read cutover cannot tolerate it. ``legacy_otus.data`` is JSONB and holds
``created_at`` as a string whatever Mongo holds, so the read path parses it back to a
datetime, and for these OTUs recovers a datetime where Mongo still has a string. The
two stores hold the same instant as different types, and the drift gate fails on it.

Mongo is the store that is wrong, so the string is parsed and written back as the
datetime every other OTU carries. Runs before the gate and after the reconciliation.

Revision ID: yok1ouqta8nf
Date: 2026-07-14 19:35:35.246783

"""

import arrow

from virtool.migration import MigrationContext
from virtool.otus.migration import repair_string_otu_created_at

# Revision identifiers.
name = "repair string otu created at"
created_at = arrow.get("2026-07-14 19:35:35.246783")
revision_id = "yok1ouqta8nf"

alembic_down_revision = None
virtool_down_revision = "ztimons6l9au"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Repair every OTU document whose ``created_at`` is a string."""
    await repair_string_otu_created_at(ctx)
