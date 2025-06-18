"""add ping.pinged_at for non-waiting jobs

Revision ID: voqrl7cqev1v
Date: 2025-06-18 00:28:58.604697

"""

import arrow

from virtool.migration import MigrationContext
from virtool.mongo.utils import get_one_field

# Revision identifiers.
name = "add ping.pinged_at for non-waiting jobs"
created_at = arrow.get("2025-06-18 00:28:58.604697")
revision_id = "voqrl7cqev1v"

alembic_down_revision = None
virtool_down_revision = "tje4jczn3c9y"

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
            {"$set": {"ping": {"pinged_at": status[-1]["timestamp"]}}},
        )
