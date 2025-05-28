from asyncio import gather

from assets.revisions.rev_1keyha5n6l0j_add_subtractions_field import upgrade
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await gather(
        ctx.mongo.samples.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "already_migrated", "subtractions": ["malus"]},
                {"_id": "baz", "subtraction": None},
            ],
        ),
        ctx.mongo.analyses.insert_many(
            [
                {"_id": "foo", "subtraction": {"id": "prunus"}},
                {"_id": "bar", "subtraction": {"id": "malus"}},
                {"_id": "already_migrated", "subtractions": ["malus"]},
                {"_id": "baz", "subtraction": None},
            ],
        ),
    )

    await upgrade(ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot(name="analyses")
    assert await ctx.mongo.samples.find().to_list(None) == snapshot(name="samples")
