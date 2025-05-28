import asyncio

from assets.revisions.rev_i0ljixkr0wxg_use_null_for_unset_analysis_results_fields import (
    upgrade,
)
from virtool.migration import MigrationContext


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
            ],
        ),
    )

    await upgrade(ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot
