"""add job created_at field

Revision ID: xi5y0imlpcq9
Date: 2025-06-19 15:10:54.039603

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "add job created_at field"
created_at = arrow.get("2025-06-19 15:10:54.039603")
revision_id = "xi5y0imlpcq9"

alembic_down_revision = None
virtool_down_revision = "voqrl7cqev1v"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """Add the `created_at` field to existing jobs based on their first status entry."""
    async for job in ctx.mongo.jobs.find(
        {"created_at": {"$exists": False}}, ["_id", "status"]
    ):
        await ctx.mongo.jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"created_at": job["status"][0]["timestamp"]}},
        )
