"""add job retries field

Revision ID: 2y6jeuxl2q0w
Date: 2025-06-17 21:32:52.935088

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "add job retries field"
created_at = arrow.get("2025-06-17 21:32:52.935088")
revision_id = "2y6jeuxl2q0w"

alembic_down_revision = "86d4e93bb0bd"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """Run the upgrade migration."""
    await ctx.mongo.jobs.update_many(
        {
            "retries": {"$exists": False},
        },
        {
            "$set": {
                "retries": 0,
            }
        },
    )
