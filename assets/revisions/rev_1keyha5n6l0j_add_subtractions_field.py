"""
Add subtractions field

Revision ID: 1keyha5n6l0j
Date: 2022-06-09 22:04:28.890559

"""
from asyncio import gather

import arrow

# Revision identifiers.
from pymongo import UpdateOne

from virtool.migration.ctx import RevisionContext

name = "Add subtractions field"
created_at = arrow.get("2022-06-09 22:04:28.890559")
revision_id = "1keyha5n6l0j"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    for collection in (ctx.mongo.database.analyses, ctx.mongo.database.samples):
        updates = []

        async for document in collection.find({"subtraction": {"$exists": True}}):
            try:
                subtractions = [document["subtraction"]["id"]]
            except TypeError:
                subtractions = list()

            update = UpdateOne(
                {"_id": document["_id"]},
                {"$set": {"subtractions": subtractions}, "$unset": {"subtraction": ""}},
            )

            updates.append(update)

        if updates:
            await collection.bulk_write(updates)


async def test_upgrade(ctx, snapshot):

    await gather(
        ctx.mongo.database.samples.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "baz", "subtraction": None},
            ]
        ),
        ctx.mongo.database.analyses.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "baz", "subtraction": None},
            ]
        ),
    )

    async with await ctx.mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(ctx)



    assert await ctx.mongo.database.analyses.find().to_list(None) == snapshot(name="analyses")
    assert await ctx.mongo.database.samples.find().to_list(None) == snapshot(name="samples")
