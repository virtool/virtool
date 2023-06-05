from __future__ import annotations

from asyncio import gather
from logging import getLogger
from typing import TYPE_CHECKING

from pymongo.errors import DuplicateKeyError

from virtool.samples.db import recalculate_workflow_tags
from virtool.types import App
from virtool.utils import chunk_list

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

logger = getLogger("mongo")


async def migrate(app: App):
    """
    Update all collections on application start.

    Used for applying MongoDB schema and file storage changes.

    :param app: the application object

    """
    await gather(migrate_status(app["db"]), recalculate_all_workflow_tags(app["db"]))


async def recalculate_all_workflow_tags(mongo: Mongo):
    """
    Recalculate workflow tags for all samples. Works on multiple samples concurrently.

    :param mongo: the application database object

    """
    logger.info("Recalculating samples workflow tags")

    sample_ids = await mongo.samples.distinct("_id")

    for chunk in chunk_list(sample_ids, 50):
        await gather(
            *[recalculate_workflow_tags(mongo, sample_id) for sample_id in chunk]
        )


async def migrate_status(mongo):
    """
    Automatically update the status collection.

    :param mongo: the application MongoDB object

    """
    logger.info("Updating HMM status")

    try:
        await mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": [],
                "installed": None,
                "task": None,
                "updates": [],
                "release": None,
            }
        )
    except DuplicateKeyError:
        if await mongo.hmm.count_documents({}):
            await mongo.status.update_one(
                {"_id": "hmm", "installed": {"$exists": False}},
                {"$set": {"installed": None}},
            )
