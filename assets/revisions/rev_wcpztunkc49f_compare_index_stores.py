"""Compare the Mongo and Postgres index stores.

Gates the index read cutover. Runs after the backfill has copied every ``indexes``
document into the ``indexes`` table, and raises if the two stores still disagree, so
reads never move to a Postgres that has silently fallen behind Mongo.

Every promoted field is compared, with ``created_at`` floored to the millisecond
BSON stores it at, embedded ``reference`` and ``user`` ids resolved to their Postgres
keys, and ``manifest`` compared as a whole map -- the silent corruption a key-set
check would miss. The check is read-only and re-runnable: it mutates neither store
and reaches the same verdict on unchanged stores.

Revision ID: wcpztunkc49f
Date: 2026-07-17 18:56:39.490214

"""

import arrow

from virtool.indexes.migration import compare_index_stores
from virtool.migration import MigrationContext

# Revision identifiers.
name = "compare index stores"
created_at = arrow.get("2026-07-17 18:56:39.490214")
revision_id = "wcpztunkc49f"

alembic_down_revision = None
virtool_down_revision = "9ws3adnisz85"

# ``6ffca63a8b95`` creates the ``indexes`` table and every promoted column this
# check compares, so requiring it guarantees they exist before the check runs.
required_alembic_revision = "6ffca63a8b95"


async def upgrade(ctx: MigrationContext) -> None:
    """Raise if the Mongo and Postgres index stores have drifted."""
    await compare_index_stores(ctx)
