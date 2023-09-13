"""
Populate sample workflows field

Revision ID: 1zg28cpib2uj
Date: 2023-06-05 20:22:37.084509

"""
import arrow

from virtool.migration import MigrationError, MigrationContext
from virtool.samples.db import recalculate_workflow_tags

# Revision identifiers.
name = "Populate sample workflows field"
created_at = arrow.get("2023-06-05 20:22:37.084509")
revision_id = "1zg28cpib2uj"

alembic_down_revision = "8af76adc9706"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """
    Add a ``workflows`` field for all samples where it is missing.

    """
    for sample_id in await ctx.mongo.samples.distinct(
        "_id", {"workflows": {"$exists": False}}
    ):
        await recalculate_workflow_tags(ctx.mongo, sample_id)

    if await ctx.mongo.samples.count_documents({"workflows": {"$exists": False}}):
        raise MigrationError("Some samples still do not have a workflows field")
