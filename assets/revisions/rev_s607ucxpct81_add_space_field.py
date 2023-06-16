"""
Add space field

Revision ID: s607ucxpct81
Date: 2023-02-08 00:06:52.287448

"""
import asyncio

import arrow

from virtool.migration import MigrationContext, MigrationError

# Revision identifiers.
name = "Add space field"
created_at = arrow.get("2023-02-08 00:06:52.287448")
revision_id = "s607ucxpct81"

alembic_down_revision = None
virtool_down_revision = "l20h8fsbbb28"


async def upgrade(ctx: MigrationContext):
    for collection in (
        ctx.mongo.analyses,
        ctx.mongo.jobs,
        ctx.mongo.references,
        ctx.mongo.samples,
        ctx.mongo.subtractions,
    ):
        await collection.update_many(
            {"space": {"$exists": False}}, {"$set": {"space": 0}}
        )

        if await collection.count_documents({"space": {"$exists": False}}):
            raise MigrationError(
                f"Some {collection.name} still do not have a space field"
            )


async def test_upgrade(ctx: MigrationContext, snapshot):
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
                {"_id": "foo", "space": {"id": 2}},
                {"_id": "bar"},
                {"_id": "baz", "space": {"id": 15}},
                {"_id": "noo"},
            ]
        )

    await upgrade(ctx)

    assert (
        await asyncio.gather(
            *[collection.find().to_list(None) for collection in collections]
        )
        == snapshot
    )
