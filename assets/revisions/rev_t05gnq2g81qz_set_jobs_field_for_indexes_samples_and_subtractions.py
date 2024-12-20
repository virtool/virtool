"""set job field for indexes, samples, and subtractions

Revision ID: t05gnq2g81qz
Date: 2024-05-31 18:43:38.988811

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "set job field for indexes, samples, and subtractions"
created_at = arrow.get("2024-05-31 18:43:38.988811")
revision_id = "t05gnq2g81qz"

alembic_down_revision = None
virtool_down_revision = "ohcocrre6rha"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    for collection in ["indexes", "samples", "subtractions"]:
        await ctx.mongo[collection].update_many(
            {"job": {"$exists": False}},
            {"$set": {"job": None}},
        )
