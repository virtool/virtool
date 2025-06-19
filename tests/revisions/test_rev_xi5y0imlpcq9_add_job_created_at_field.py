import arrow

from assets.revisions.rev_xi5y0imlpcq9_add_job_created_at_field import upgrade
from virtool.migration.ctx import MigrationContext


async def test_upgrade(ctx: MigrationContext):
    """Test that created_at field is added to jobs based on first status timestamp."""
    timestamp_1 = arrow.get("2023-01-01T10:00:00Z").naive
    timestamp_2 = arrow.get("2023-01-02T10:00:00Z").naive
    timestamp_3 = arrow.get("2023-01-03T10:00:00Z").naive

    await ctx.mongo.jobs.insert_many(
        [
            # Job without created_at, should get it from first status
            {
                "_id": "job_1",
                "status": [
                    {"state": "waiting", "timestamp": timestamp_1},
                    {"state": "running", "timestamp": timestamp_2},
                ],
            },
            # Job already with created_at, should not be modified
            {
                "_id": "job_2",
                "created_at": timestamp_3,
                "status": [
                    {"state": "waiting", "timestamp": timestamp_1},
                ],
            },
            # Job without created_at but with single status entry
            {
                "_id": "job_3",
                "status": [
                    {"state": "complete", "timestamp": timestamp_2},
                ],
            },
        ],
    )

    await upgrade(ctx)

    jobs = await ctx.mongo.jobs.find().to_list(None)
    jobs_by_id = {job["_id"]: job for job in jobs}

    # Job 1 should have created_at set to first status timestamp
    assert jobs_by_id["job_1"]["created_at"] == timestamp_1

    # Job 2 should keep its original created_at (not modified)
    assert jobs_by_id["job_2"]["created_at"] == timestamp_3

    # Job 3 should have created_at set to its only status timestamp
    assert jobs_by_id["job_3"]["created_at"] == timestamp_2
