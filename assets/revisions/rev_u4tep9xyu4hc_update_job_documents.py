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
virtool_down_revision = "lcq797n5ryxk"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.jobs.update_many(
        {"key": {"$exists": False}},
        {"$set": {"key": None}},
    )
    await ctx.mongo.jobs.update_many(
        {"acquired": {"$exists": False}},
        {"$set": {"acquired": True}},
    )
    await ctx.mongo.jobs.update_many(
        {"archived": {"$exists": False}},
        {"$set": {"archived": False}},
    )
    await ctx.mongo.jobs.update_many(
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
                                "$mergeObjects": [
                                    "$$single_status",
                                    {
                                        "progress": {
                                            "$toInt": {
                                                "$multiply": [
                                                    "$$single_status.progress",
                                                    100,
                                                ],
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {"$merge": {"into": "jobs", "on": "_id", "whenMatched": "replace"}},
        ],
    ).to_list(length=None)
