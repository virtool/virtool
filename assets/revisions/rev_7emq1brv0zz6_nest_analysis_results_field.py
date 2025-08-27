"""Nest analysis results field

Revision ID: 7emq1brv0zz6
Date: 2022-06-09 20:38:11.017655

"""

import arrow

# Revision identifiers.
from virtool.migration import MigrationContext

name = "Nest analysis results field"
created_at = arrow.get("2022-06-09 20:38:11.017655")
revision_id = "7emq1brv0zz6"

alembic_down_revision = "90bf491700cb"
virtool_down_revision = None


async def upgrade(ctx: MigrationContext) -> None:
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
