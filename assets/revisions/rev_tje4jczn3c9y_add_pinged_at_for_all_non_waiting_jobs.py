"""add pinged_at for all non-waiting jobs

Revision ID: tje4jczn3c9y
Date: 2025-06-17 23:45:00.497926

"""

import arrow

from virtool.migration import MigrationContext
from virtool.mongo.utils import get_one_field

# Revision identifiers.
name = "add pinged_at for all non-waiting jobs"
created_at = arrow.get("2025-06-17 23:45:00.497926")
revision_id = "tje4jczn3c9y"

alembic_down_revision = None
virtool_down_revision = "2y6jeuxl2q0w"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """Add the `pinged_at` field to all non-waiting jobs.

    Use the last status timestamp for jobs that do not have a `pinged_at` field.

    :param ctx: the migration context
    """
    query = {"status.-1.state": {"$ne": "waiting"}, "ping": None}

    for job_id in await ctx.mongo.jobs.distinct("_id", query):
        status = await get_one_field(ctx.mongo.jobs, "status", job_id)

        await ctx.mongo.jobs.update_one(
            {"_id": job_id, **query},
            {"$set": {"pinged_at": status[-1]["timestamp"]}},
        )
