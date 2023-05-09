"""
Add jobs ping field

Revision ID: 6q5k8tz8uph3
Date: 2022-10-07 20:14:53.735862

"""
from datetime import datetime

import arrow
from syrupy.matchers import path_type

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Add jobs ping field"
created_at = arrow.get("2022-10-07 20:14:53.735862")
revision_id = "6q5k8tz8uph3"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    await ctx.mongo.database.jobs.update_many(
        {"ping": {"$exists": False}},
        {"$set": {"ping": None}},
        session=ctx.mongo.session,
    )


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.jobs.insert_many(
        [
            {"_id": "a", "ping": None},
            {"_id": "b"},
            {"_id": "c", "ping": {"pinged_at": arrow.utcnow().naive}},
            {"_id": "d"},
        ]
    )

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert await ctx.mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True)
    )
