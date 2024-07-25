"""update job documents

Revision ID: u4tep9xyu4hc
Date: 2024-06-24 20:52:26.979589

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "update job documents"
created_at = arrow.get("2024-06-24 20:52:26.979589")
revision_id = "u4tep9xyu4hc"

alembic_down_revision = None
virtool_down_revision = "zma2wj6b39hs"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    ctx.mongo.jobs.update_many({"key": {"$exists": False}}, {"$set": {"key": None}})
    ctx.mongo.jobs.update_many(
        {"acquired": {"$exists": False}},
        {"$set": {"acquired": True}},
    )
    ctx.mongo.jobs.update_many(
        {"archived": {"$exists": False}},
        {"$set": {"archived": False}},
    )
    ctx.mongo.jobs.update_many(
        {"task": {"$exists": True}},
        {"$rename": {"task": "workflow"}},
    )

    await ctx.mongo.jobs.aggregate(
        [
            {
                "$match": {
                    "$expr": {
                        "$anyElementTrue": {
                            "$map": {
                                "input": "$status",
                                "as": "single_status",
                                "in": {
                                    "$or": [
                                        {
                                            "$and": [
                                                {
                                                    "$eq": [
                                                        "$$single_status.state",
                                                        "complete",
                                                    ],
                                                },
                                                {
                                                    "$eq": [
                                                        "$$single_status.progress",
                                                        1,
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            "$eq": [
                                                {
                                                    "$type": "$$single_status.progress",
                                                },
                                                "double",
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            {
                "$set": {
                    "status": {
                        "$map": {
                            "input": "$status",
                            "as": "single_status",
                            "in": {
                                "$setField": {
                                    "field": "progress",
                                    "input": "$$single_status",
                                    "value": {
                                        "$toInt": {
                                            "$multiply": [
                                                "$$single_status.progress",
                                                100,
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            {"$merge": {"into": "jobs", "on": "_id", "whenMatched": "replace"}},
        ],
    ).to_list(length=None)


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
