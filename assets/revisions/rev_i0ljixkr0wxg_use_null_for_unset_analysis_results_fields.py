"""
Use null for unset analysis results fields

Revision ID: i0ljixkr0wxg
Date: 2022-10-03 19:29:47.077288

"""
import asyncio

import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Use null for unset analysis results fields"
created_at = arrow.get("2022-10-03 19:29:47.077288")
revision_id = "i0ljixkr0wxg"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    await ctx.mongo.database.analyses.update_many(
        {"results": {"$exists": False}},
        {"$set": {"results": None}},
        session=ctx.mongo.session,
    )


async def test_upgrade(ctx, snapshot):
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
                {
                    "_id": "baz",
                    "results": None,
                    "workflow": "nuvs",
                },
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

    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot
