from asyncio import gather

from virtool.db.migrate_shared import add_subtractions_field
from virtool.db.utils import delete_unready
from virtool.samples.db import recalculate_workflow_tags
from virtool.types import App
from virtool.utils import chunk_list


async def migrate_samples(app: App):
    """
    Automatically update sample documents on application start.

    Recalculate all sample workflow tags and delete unready samples.

    :param app: the application object
    """
    db = app["db"]

    await delete_unready(db.samples)
    await recalculate_all_workflow_tags(db)
    await add_subtractions_field(db.samples)
    await add_is_legacy(db)


async def add_is_legacy(db):
    """
    As `is_legacy` field to samples to make it more obvious that they are legacy samples.

    :param db: the application object

    """
    await db.samples.update_many({"files.raw": False}, {"$set": {"is_legacy": True}})

    await db.samples.update_many({"files.raw": True}, {"$set": {"is_legacy": False}})


async def recalculate_all_workflow_tags(db):
    """
    Recalculate workflow tags for all samples. Works on multiple samples concurrently.

    :param db: the application database object

    """
    sample_ids = await db.samples.distinct("_id")

    for chunk in chunk_list(sample_ids, 50):
        await gather(*[recalculate_workflow_tags(db, sample_id) for sample_id in chunk])
