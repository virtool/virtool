from datetime import datetime

import arrow
from syrupy.matchers import path_type

from assets.revisions.rev_tje4jczn3c9y_add_pinged_at_for_all_non_waiting_jobs import (
    upgrade,
)


async def test_upgrade(ctx, snapshot):
    timestamp = arrow.get("2025-06-17 23:45:00").naive

    await ctx.mongo.jobs.insert_many(
        [
            {
                "_id": "waiting_job",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                ],
            },
            {
                "_id": "running_job_without_pinged_at",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                ],
            },
            {
                "_id": "complete_job_without_pinged_at",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                    {"state": "complete", "timestamp": timestamp},
                ],
            },
            {
                "_id": "job_with_existing_ping",
                "ping": {"pinged_at": timestamp},
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                ],
            },
            {
                "_id": "error_job_without_pinged_at",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                    {"state": "error", "timestamp": timestamp},
                ],
            },
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True),
    )
