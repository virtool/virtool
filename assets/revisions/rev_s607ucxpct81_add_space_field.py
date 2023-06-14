"""
Add space field

Revision ID: s607ucxpct81
Date: 2023-02-08 00:06:52.287448

"""
import asyncio

import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Add space field"
created_at = arrow.get("2023-02-08 00:06:52.287448")
revision_id = "s607ucxpct81"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    for collection in (
        ctx.mongo.database.analyses,
        ctx.mongo.database.jobs,
        ctx.mongo.database.references,
        ctx.mongo.database.samples,
        ctx.mongo.database.subtractions,
    ):
        await collection.update_many(
            {"space": {"$exists": False}},
            {"$set": {"space": 0}},
        )


async def test_upgrade(ctx, snapshot):
    collections = (
        ctx.mongo.analyses,
        ctx.mongo.jobs,
        ctx.mongo.references,
        ctx.mongo.samples,
        ctx.mongo.subtractions,
    )

    for collection in collections:
        await collection.delete_many({})
        await collection.insert_many(
            [
                {
                    "_id": "foo",
                    "space": {"id": 2},
                },
                {
                    "_id": "bar",
                },
                {
                    "_id": "baz",
                    "space": {"id": 15},
                },
                {
                    "_id": "noo",
                },
            ]
        )

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert (
        await asyncio.gather(
            *[collection.find().to_list(None) for collection in collections]
        )
        == snapshot
    )
