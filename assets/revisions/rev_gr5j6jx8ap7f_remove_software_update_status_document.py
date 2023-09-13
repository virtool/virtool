"""
Remove software_update status document

Revision ID: gr5j6jx8ap7f
Date: 2022-06-09 22:20:48.591743

"""
import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "Remove software_update status document"
created_at = arrow.get("2022-06-09 22:20:48.591743")
revision_id = "gr5j6jx8ap7f"

alembic_down_revision = None
virtool_down_revision = "1p681ke9wedv"


async def upgrade(ctx: MigrationContext):
    async with await ctx.mongo.client.start_session() as session, session.start_transaction():
        await ctx.mongo.status.delete_many(
            {"_id": {"$in": ["software", "software_update", "version"]}},
            session=session,
        )


async def test_upgrade(ctx: MigrationContext):
    await ctx.mongo.status.insert_many(
        [
            {"_id": "software_update", "foo": "bar"},
            {"_id": "version", "foo": "bar"},
            {"_id": "software"},
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.status.find().to_list(None) == []
