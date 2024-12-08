"""Nest analysis results field

Revision ID: 7emq1brv0zz6
Date: 2022-06-09 20:38:11.017655

"""

import asyncio

import arrow

# Revision identifiers.
from virtool.migration import MigrationContext

name = "Nest analysis results field"
created_at = arrow.get("2022-06-09 20:38:11.017655")
revision_id = "7emq1brv0zz6"

alembic_down_revision = "90bf491700cb"
virtool_down_revision = None


async def upgrade(ctx: MigrationContext):
    """Move the ``subtracted_count`` and ``read_count`` fields from the document to the
    ``results`` sub-document.

    This supports the new jobs API model where only a ``results`` field can be set on
    the analysis document by a workflow job.

    """
    # We are only interested in analyses that have a non-``None`` ``results`` field
    # but no ``results.hits`` field, which indicates it is an older analysis.
    query = {
        "results": {"$ne": None, "$exists": True},
        "results.hits": {"$exists": False},
    }

    async for document in ctx.mongo.analyses.find(query):
        results = {"hits": document["results"]}
        update = {}
        if document["workflow"] == "pathoscope_bowtie":
            update = {
                "$set": {
                    "results": {
                        **results,
                        "read_count": document["read_count"],
                        # TODO: add a migration that detects cases where
                        # subtraction_count DNE and set a flag.
                        # This prevents the crash during migration, but
                        # does not correct the underlying data structure
                        # problem
                        **(
                            {
                                "subtracted_count": document["subtracted_count"],
                            }
                            if "subtracted_count" in document
                            else {}
                        ),
                    },
                },
                "$unset": {"read_count": "", "subtracted_count": ""},
            }

        elif document["workflow"] == "nuvs":
            update = {"$set": {"results": results}}

        elif document["workflow"] == "aodp":
            update = {
                "$set": {
                    "results": {
                        **results,
                        "join_histogram": document["join_histogram"],
                        "joined_pair_count": document["joined_pair_count"],
                        "remainder_pair_count": document["remainder_pair_count"],
                    },
                },
                "$unset": {
                    "join_histogram": "",
                    "joined_pair_count": "",
                    "remainder_pair_count": "",
                },
            }

        if update:
            await ctx.mongo.analyses.update_one({"_id": document["_id"]}, update)

    if await ctx.mongo.analyses.count_documents(query) > 0:
        raise Exception("Some analyses still have a non-nested results field")


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
