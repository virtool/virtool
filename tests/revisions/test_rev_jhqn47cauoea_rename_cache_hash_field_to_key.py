import asyncio

from assets.revisions.rev_jhqn47cauoea_rename_cache_hash_field_to_key import upgrade
from virtool.migration import MigrationContext


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
            ],
        ),
    )

    await upgrade(ctx)

    assert await ctx.mongo.caches.find().to_list(None) == snapshot
