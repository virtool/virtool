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
                subtractions = []

            update = UpdateOne(
                {"_id": document["_id"]},
                {"$set": {"subtractions": subtractions}, "$unset": {"subtraction": ""}},
            )

            updates.append(update)

        if updates:
            await collection.bulk_write(updates, session=ctx.mongo.session)


async def test_upgrade(ctx, snapshot):
    await gather(
        ctx.mongo.samples.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "baz", "subtraction": None},
            ]
        ),
        ctx.mongo.analyses.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "baz", "subtraction": None},
            ]
        ),
    )

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot(name="analyses")
    assert await ctx.mongo.samples.find().to_list(None) == snapshot(name="samples")
