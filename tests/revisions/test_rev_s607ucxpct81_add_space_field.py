import asyncio

from assets.revisions.rev_s607ucxpct81_add_space_field import upgrade
from virtool.migration import MigrationContext


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
            ],
        )

    await upgrade(ctx)

    assert (
        await asyncio.gather(
            *[collection.find().to_list(None) for collection in collections],
        )
        == snapshot
    )
