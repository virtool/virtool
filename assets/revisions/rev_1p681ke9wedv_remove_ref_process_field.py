"""
Remove ref process field

Revision ID: 1p681ke9wedv
Date: 2022-06-09 22:17:02.297460

"""

import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Remove ref process field"
created_at = arrow.get("2022-06-09 22:17:02.297460")
revision_id = "1p681ke9wedv"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    await ctx.mongo.database.references.update_many(
        {}, {"$unset": {"process": ""}}, session=ctx.mongo.session
    )


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.references.insert_many(
        [{"_id": "foo", "process": "test"}, {"_id": "bar", "task": "test"}]
    )

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert await ctx.mongo.references.find().to_list(None) == snapshot
