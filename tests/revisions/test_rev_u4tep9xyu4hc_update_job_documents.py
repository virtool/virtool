from assets.revisions.rev_u4tep9xyu4hc_update_job_documents import upgrade


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.jobs.insert_many(
        [
            {
                "_id": "complete_legacy_job",
                "task": "create_sample",
                "status": [
                    {"state": "waiting", "stage": None, "error": None, "progress": 0},
                    {
                        "state": "running",
                        "stage": "make_sample_dir",
                        "error": None,
                        "progress": 0.173,
                    },
                    {
                        "state": "complete",
                        "stage": "clean_watch",
                        "error": None,
                        "progress": 1,
                    },
                ],
            },
            {
                "_id": "instant_complete_legacy_job",
                "task": "create_sample",
                "status": [
                    {"state": "waiting", "stage": None, "error": None, "progress": 0},
                    {
                        "state": "complete",
                        "stage": "clean_watch",
                        "error": None,
                        "progress": 1,
                    },
                ],
            },
            {
                "_id": "incomplete_legacy_job",
                "task": "create_sample",
                "status": [
                    {"state": "waiting", "stage": None, "error": None, "progress": 0},
                    {
                        "state": "running",
                        "stage": "make_sample_dir",
                        "error": None,
                        "progress": 0.173,
                    },
                ],
            },
            {
                "_id": "modern_job",
                "workflow": "create_sample",
                "key": "job-api-key",
                "acquired": True,
                "archived": False,
                "status": [
                    {"state": "waiting", "stage": None, "error": None, "progress": 0},
                    {
                        "state": "running",
                        "stage": "run_fast_qc",
                        "error": None,
                        "progress": 50,
                    },
                    {
                        "state": "complete",
                        "stage": "clean_watch",
                        "error": None,
                        "progress": 100,
                    },
                ],
            },
        ],
    )

    await upgrade(ctx)

    assert [job async for job in ctx.mongo.jobs.find()] == snapshot
