from assets.revisions.rev_1p681ke9wedv_remove_ref_process_field import upgrade
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.references.insert_many(
        [{"_id": "foo", "process": "test"}, {"_id": "bar", "task": "test"}],
    )

    await upgrade(ctx)

    assert await ctx.mongo.references.find().to_list(None) == snapshot
