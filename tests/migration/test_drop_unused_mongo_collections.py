"""Tests for the drop-unused-mongo-collections migration."""

from assets.revisions.rev_k9s3n2p7x4qa_drop_unused_mongo_collections import upgrade
from virtool.migration.ctx import MigrationContext


async def test_upgrade_drops_unused_collections(ctx: MigrationContext):
    for collection_name in ("caches", "groups", "sessions"):
        await ctx.mongo[collection_name].insert_one({"_id": collection_name})

    await ctx.mongo.retained.insert_one({"_id": "retained"})

    await upgrade(ctx)

    collection_names = await ctx.mongo.list_collection_names()

    assert "caches" not in collection_names
    assert "groups" not in collection_names
    assert "sessions" not in collection_names
    assert "retained" in collection_names


async def test_upgrade_is_idempotent(ctx: MigrationContext):
    await upgrade(ctx)
    await upgrade(ctx)

    collection_names = await ctx.mongo.list_collection_names()

    assert "caches" not in collection_names
    assert "groups" not in collection_names
    assert "sessions" not in collection_names
