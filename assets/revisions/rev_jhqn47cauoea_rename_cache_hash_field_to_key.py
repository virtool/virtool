"""
Rename cache hash field to key

Revision ID: jhqn47cauoea
Date: 2022-06-09 22:12:49.222586

"""
import asyncio

import arrow

from virtool.migration import MigrationContext, MigrationError

# Revision identifiers.
name = "Rename cache hash field to key"
created_at = arrow.get("2022-06-09 22:12:49.222586")
revision_id = "jhqn47cauoea"

alembic_down_revision = None
virtool_down_revision = "1keyha5n6l0j"


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.caches.update_many({}, {"$rename": {"hash": "key"}})

    if await ctx.mongo.caches.count_documents({"hash": {"$exists": True}}):
        raise MigrationError("Some caches still have a hash field")


async def test_upgrade(ctx: MigrationContext, snapshot):
    await asyncio.gather(
        ctx.mongo.caches.insert_many(
            [
                {
                    "_id": "foo",
                    "hash": "a97439e170adc4365c5b92bd2c148ed57d75e566",
                    "sample": {"id": "abc"},
                },
                {
                    "_id": "bar",
                    "hash": "d7fh3ee170adc4365c5b92bd2c1f3fd5745te566",
                    "sample": {"id": "dfg"},
                },
            ]
        )
    )

    await upgrade(ctx)

    assert await ctx.mongo.caches.find().to_list(None) == snapshot
