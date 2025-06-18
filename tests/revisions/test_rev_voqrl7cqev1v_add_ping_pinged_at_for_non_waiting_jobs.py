from datetime import datetime

import arrow
from syrupy.matchers import path_type

from assets.revisions.rev_voqrl7cqev1v_add_ping_pinged_at_for_non_waiting_jobs import (
    upgrade,
)


async def test_upgrade(ctx, snapshot):
    timestamp = arrow.get("2025-06-18 10:00:00").naive

    await ctx.mongo.jobs.insert_many(
        [
            {
                "_id": "waiting_job_with_no_ping",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                ],
            },
            {
                "_id": "running_job_with_no_ping",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                ],
            },
            {
                "_id": "complete_job_with_no_ping",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                    {"state": "complete", "timestamp": timestamp},
                ],
            },
            {
                "_id": "error_job_with_no_ping",
                "ping": None,
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                    {"state": "error", "timestamp": timestamp},
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
                "_id": "job_without_ping_field",
                "status": [
                    {"state": "waiting", "timestamp": timestamp},
                    {"state": "running", "timestamp": timestamp},
                ],
            },
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True),
    )
