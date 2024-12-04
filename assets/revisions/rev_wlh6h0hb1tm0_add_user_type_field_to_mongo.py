"""add user type field to mongo

Revision ID: wlh6h0hb1tm0
Date: 2024-12-04 16:29:19.348922

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "add user type field to mongo"
created_at = arrow.get("2024-12-04 16:29:19.348922")
revision_id = "wlh6h0hb1tm0"

alembic_down_revision = "e52b2748f384"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    ctx.mongo.users.update_many(
        {"type": {"$exists": False}},
        {"$set": {"type": "user"}},
    )


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.users.insert_many(
        [
            {"_id": "no type"},
            {"_id": "user_type", "type": "user"},
            {"_id": "bot_type", "type": "bot"},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find({}).to_list() == snapshot()
