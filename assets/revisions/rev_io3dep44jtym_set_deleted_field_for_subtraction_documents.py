"""set deleted field for subtraction documents

Revision ID: io3dep44jtym
Date: 2024-05-27 20:43:33.597733

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "set deleted field for subtraction documents"
created_at = arrow.get("2024-05-27 20:43:33.597733")
revision_id = "io3dep44jtym"

alembic_down_revision = None
virtool_down_revision = "0p3nhjg1fcfj"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.subtraction.update_many(
        {"deleted": {"$exists": False}},
        {"$set": {"deleted": False}},
    )
