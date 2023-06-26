"""
Remove ref process field

Revision ID: 1p681ke9wedv
Date: 2022-06-09 22:17:02.297460

"""

import arrow

from virtool.migration import MigrationContext, MigrationError

# Revision identifiers.
name = "Remove ref process field"
created_at = arrow.get("2022-06-09 22:17:02.297460")
revision_id = "1p681ke9wedv"

alembic_down_revision = None
virtool_down_revision = "jhqn47cauoea"


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.references.update_many({}, {"$unset": {"process": ""}})

    if await ctx.mongo.references.count_documents({"process": {"$exists": True}}):
        raise MigrationError("Some references still have a process field")


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.references.insert_many(
        [{"_id": "foo", "process": "test"}, {"_id": "bar", "task": "test"}]
    )

    await upgrade(ctx)

    assert await ctx.mongo.references.find().to_list(None) == snapshot
