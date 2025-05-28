import asyncio

from assets.revisions.rev_7emq1brv0zz6_nest_analysis_results_field import upgrade

# Revision identifiers.
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await asyncio.gather(
        ctx.mongo.analyses.delete_many({}),
        ctx.mongo.analyses.insert_many(
            [
                {
                    "_id": "foo",
                    "read_count": 1209,
                    "results": [1, 2, 3, 4, 5],
                    "subtracted_count": 231,
                    "workflow": "pathoscope_bowtie",
                },
                {
                    "_id": "fine",
                    "results": {
                        "hits": [1, 2, 3, 4, 5],
                        "read_count": 1209,
                        "subtracted_count": 231,
                    },
                    "workflow": "pathoscope_bowtie",
                },
                {
                    "_id": "bar",
                    "read_count": 7982,
                    "results": [9, 8, 7, 6, 5],
                    "subtracted_count": 112,
                    "workflow": "pathoscope_bowtie",
                },
                {
                    "_id": "no_subtracted_count",
                    "read_count": 1209,
                    "results": [1, 2, 3, 4, 5],
                    "workflow": "pathoscope_bowtie",
                },
                {"_id": "baz", "results": [9, 8, 7, 6, 5], "workflow": "nuvs"},
                {
                    "_id": "bad",
                    "join_histogram": [1, 2, 3, 4, 5],
                    "joined_pair_count": 12345,
                    "remainder_pair_count": 54321,
                    "results": [9, 8, 7, 6, 5],
                    "workflow": "aodp",
                },
                {
                    "_id": "missing",
                    "join_histogram": [1, 2, 3, 4, 5],
                    "joined_pair_count": 12345,
                    "remainder_pair_count": 54321,
                    "workflow": "aodp",
                },
                {
                    "_id": "none",
                    "join_histogram": [1, 2, 3, 4, 5],
                    "joined_pair_count": 12345,
                    "remainder_pair_count": 54321,
                    "results": None,
                    "workflow": "aodp",
                },
            ],
        ),
    )

    await upgrade(ctx)

    assert await ctx.mongo.analyses.find().to_list(None) == snapshot
