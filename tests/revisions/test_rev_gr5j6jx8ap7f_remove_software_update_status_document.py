from assets.revisions.rev_gr5j6jx8ap7f_remove_software_update_status_document import (
    upgrade,
)
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext):
    await ctx.mongo.status.insert_many(
        [
            {"_id": "software_update", "foo": "bar"},
            {"_id": "version", "foo": "bar"},
            {"_id": "software"},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.status.find().to_list(None) == []
