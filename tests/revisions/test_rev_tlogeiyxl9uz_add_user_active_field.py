from assets.revisions.rev_tlogeiyxl9uz_add_user_active_field import upgrade
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.users.insert_many(
        [
            {"_id": "bob", "active": False},
            {"_id": "dave", "active": True},
            {"_id": "fran"},
            {"_id": "mary"},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find().to_list(None) == snapshot
