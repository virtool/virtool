"""
Add jobs ping field

Revision ID: 6q5k8tz8uph3
Date: 2022-10-07 20:14:53.735862

"""
from datetime import datetime

import arrow
from syrupy.matchers import path_type

from virtool.migration import MigrationError
from virtool.migration.ctx import MigrationContext

# Revision identifiers.
name = "Add jobs ping field"
created_at = arrow.get("2022-10-07 20:14:53.735862")
revision_id = "6q5k8tz8uph3"

alembic_down_revision = None
virtool_down_revision = "i0ljixkr0wxg"


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.jobs.update_many(
        {"ping": {"$exists": False}}, {"$set": {"ping": None}}
    )

    if await ctx.mongo.jobs.count_documents({"ping": {"$exists": False}}):
        raise MigrationError("Some jobs still do not have a ping field")


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.jobs.insert_many(
        [
            {"_id": "a", "ping": None},
            {"_id": "b"},
            {"_id": "c", "ping": {"pinged_at": arrow.utcnow().naive}},
            {"_id": "d"},
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True)
    )
