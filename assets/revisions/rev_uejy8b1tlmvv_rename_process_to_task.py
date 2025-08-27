"""rename process to task

Revision ID: uejy8b1tlmvv
Date: 2024-06-04 16:52:09.648183

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "rename process to task"
created_at = arrow.get("2024-06-04 16:52:09.648183")
revision_id = "uejy8b1tlmvv"

alembic_down_revision = None
virtool_down_revision = "jlq24f8q12pk"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.references.update_many(
        {"process": {"$exists": True}},
        {"$rename": {"process": "task"}},
    )
    await ctx.mongo.references.update_many(
        {"task": {"$exists": False}},
        {"$set": {"task": None}},
    )

    await ctx.mongo.status.update_one(
        {"_id": "hmm", "process": {"$exists": True}},
        {"$rename": {"process": "task"}},
    )
