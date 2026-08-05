"""delete stale hmm annotations blob

The gzipped HMM annotations file served to workflows is derived data cached in
object storage. Annotations are now identified by their Postgres integer id
instead of the legacy Mongo string, but a blob generated before that switch is
still cached and served verbatim, so the ``hmms`` workflow fixture fails to
parse it.

Deleting the object makes the next download regenerate it from Postgres.

Revision ID: 8kt397kdecbe
Date: 2026-08-05 23:07:48.393734

"""

import arrow

from virtool.hmm.data import HMM_ANNOTATIONS_KEY
from virtool.migration import MigrationContext

# Revision identifiers.
name = "delete stale hmm annotations blob"
created_at = arrow.get("2026-08-05 23:07:48.393734")
revision_id = "8kt397kdecbe"

alembic_down_revision = "0cbbc3b23245"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    await ctx.storage.delete(HMM_ANNOTATIONS_KEY)
