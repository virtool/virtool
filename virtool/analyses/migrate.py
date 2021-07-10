from pymongo import UpdateOne

import virtool.db.migrate
import virtool.db.migrate_shared
import virtool.db.utils
import virtool.types
from virtool.db.utils import buffered_bulk_writer


async def migrate_analyses(app: virtool.types.App):
    """
    Delete unready analyses.

    :param app: the application object

    """
    await virtool.db.utils.delete_unready(app["db"].analyses)
    await virtool.db.migrate_shared.add_subtractions_field(app["db"].analyses)
    await nest_results(app["db"])


async def nest_results(db):
    """
    Move the ``subtracted_count`` and ``read_count`` fields from the document to the ``results`` subdocument.

    This supports the new jobs API model where only a ``results`` field can be set on the analysis document by a
    workflow job.

    :param db: the application database object

    """
    async with buffered_bulk_writer(db.analyses) as writer:
        async for document in db.analyses.find({"results.hits": {"$exists": False}}):
            _id = document["_id"]

            results = {
                "hits": document["results"],
            }

            if document["workflow"] == "pathoscope_bowtie":
                await writer.add(
                    UpdateOne({"_id": document["_id"]}, {
                        "$set": {
                            "results": {
                                **results,
                                "read_count": document["read_count"],
                                "subtracted_count": document["subtracted_count"]
                            }
                        },
                        "$unset": {
                            "read_count": "",
                            "subtracted_count": ""
                        }
                    })
                )

            elif document["workflow"] == "nuvs":
                await writer.add(
                    UpdateOne({"_id": document["_id"]}, {
                        "$set": {
                            "results": results
                        }
                    })
                )

            elif document["workflow"] == "aodp":
                await writer.add(
                    UpdateOne({"_id": document["_id"]}, {
                        "$set": {
                            "results": {
                                **results,
                                "join_histogram": document["join_histogram"],
                                "joined_pair_count": document["joined_pair_count"],
                                "remainder_pair_count": document["remainder_pair_count"],
                            }
                        },
                        "$unset": {
                            "join_histogram": "",
                            "joined_pair_count": "",
                            "remainder_pair_count": "",
                        }
                    })
                )
