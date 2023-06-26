"""
Use null for unset analysis results fields

Revision ID: i0ljixkr0wxg
Date: 2022-10-03 19:29:47.077288

"""
import asyncio

import arrow

from virtool.migration import MigrationContext, MigrationError

# Revision identifiers.
name = "Use null for unset analysis results fields"
created_at = arrow.get("2022-10-03 19:29:47.077288")
revision_id = "i0ljixkr0wxg"

alembic_down_revision = None
virtool_down_revision = "tlogeiyxl9uz"


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.analyses.update_many(
        {"results": {"$exists": False}}, {"$set": {"results": None}}
    )

    if await ctx.mongo.analyses.count_documents({"results": {"$exists": False}}):
        raise MigrationError("Some analyses are missing results fields")


async def test_upgrade(ctx: MigrationContext, snapshot):
    await asyncio.gather(
        ctx.mongo.analyses.delete_many({}),
        ctx.mongo.analyses.insert_many(
            [
                {
                    "_id": "bat",
                    "join_histogram": [1, 2, 3, 4, 5],
                    "joined_pair_count": 12345,
                    "remainder_pair_count": 54321,
                    "workflow": "aodp",
                },
                {
                    "_id": "bar",
                    "read_count": 7982,
                    "results": [9, 8, 7, 6, 5],
                    "subtracted_count": 112,
                    "workflow": "pathoscope_bowtie",
                },
                {"_id": "baz", "results": None, "workflow": "nuvs"},
                {
                    "_id": "bad",
                    "join_histogram": [1, 2, 3, 4, 5],
                    "joined_pair_count": 12345,
                    "remainder_pair_count": 54321,
                    "workflow": "aodp",
                },
            ]
        ),
    )

    await upgrade(ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot
