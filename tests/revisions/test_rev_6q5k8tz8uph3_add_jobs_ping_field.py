from datetime import datetime

import arrow
from syrupy.matchers import path_type

from assets.revisions.rev_6q5k8tz8uph3_add_jobs_ping_field import upgrade
from virtool.migration.ctx import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.jobs.insert_many(
        [
            {"_id": "a", "ping": None},
            {"_id": "b"},
            {"_id": "c", "ping": {"pinged_at": arrow.utcnow().naive}},
            {"_id": "d"},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True),
    )
