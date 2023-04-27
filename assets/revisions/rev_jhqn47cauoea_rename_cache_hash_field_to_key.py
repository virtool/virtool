"""
Rename cache hash field to key

Revision ID: jhqn47cauoea
Date: 2022-06-09 22:12:49.222586

"""
import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Rename cache hash field to key"
created_at = arrow.get("2022-06-09 22:12:49.222586")
revision_id = "jhqn47cauoea"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    await ctx.mongo.database.caches.update_many({}, {"$rename": {"hash": "key"}})


async def test_upgrade(ctx, snapshot):

    await ctx.mongo.database.caches.insert_many(
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

    await upgrade(ctx)

    assert await ctx.mongo.database.caches.find().to_list(None) == snapshot
