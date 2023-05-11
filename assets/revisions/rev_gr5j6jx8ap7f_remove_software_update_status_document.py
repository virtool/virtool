"""
Remove software_update status document

Revision ID: gr5j6jx8ap7f
Date: 2022-06-09 22:20:48.591743

"""
import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Remove software_update status document"
created_at = arrow.get("2022-06-09 22:20:48.591743")
revision_id = "gr5j6jx8ap7f"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    await ctx.mongo.database.status.delete_many(
        {"_id": {"$in": ["software", "software_update", "version"]}},
        session=ctx.mongo.session,
    )


async def test_upgrade(ctx):
    await ctx.mongo.status.insert_many(
        [
            {"_id": "software_update", "foo": "bar"},
            {"_id": "version", "foo": "bar"},
            {"_id": "software"},
        ]
    )

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert await ctx.mongo.status.find().to_list(None) == []
