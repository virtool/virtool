"""
Populate sample workflows field

Revision ID: 1zg28cpib2uj
Date: 2023-06-05 20:22:37.084509

"""
import arrow

from virtool.migration.ctx import RevisionContext
from virtool.samples.db import recalculate_workflow_tags

# Revision identifiers.
name = "Populate sample workflows field"
created_at = arrow.get("2023-06-05 20:22:37.084509")
revision_id = "1zg28cpib2uj"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    """
    Add a ``workflows`` field for all samples where it is missing.

    """
    for sample_id in await ctx.mongo.database.samples.distinct(
        "_id", {"workflows": {"$exists": False}}
    ):
        await recalculate_workflow_tags(ctx.mongo, sample_id, session=ctx.mongo.session)
