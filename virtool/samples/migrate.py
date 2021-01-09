import asyncio

import virtool.db.utils
import virtool.samples.db
import virtool.types
import virtool.utils


async def migrate_samples(app: virtool.types.App):
    """
    Automatically update sample documents on application start.

    Recalculate all sample workflow tags and delete unready samples.

    :param app: the application object

    """
    db = app["db"]

    await recalculate_all_workflow_tags(db)
    await virtool.db.utils.delete_unready(db.samples)
    await change_to_subtractions_list(db)


async def recalculate_all_workflow_tags(db):
    """
    Recalculate workflow tags for all samples. Works on multiple samples concurrently.

    :param db: the application database object

    """
    sample_ids = await db.samples.distinct("_id")

    for chunk in virtool.utils.chunk_list(sample_ids, 50):
        coros = [virtool.samples.db.recalculate_workflow_tags(db, sample_id) for sample_id in chunk]
        await asyncio.gather(*coros)


async def change_to_subtractions_list(db):
    """
    Transform `subtraction` field to a list and rename it as `subtractions`.

    :param db: the application database object

    """
    async for document in db.samples.find({"subtraction": {"$exists": True}}):
        await db.samples.update_one({"_id": document["_id"]}, {
            "$set": {
                "subtractions": [document["subtraction"]["id"]]
            },
            "$unset": {
                "subtraction": ""
            }
        })