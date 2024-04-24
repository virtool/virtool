from typing import TYPE_CHECKING

from pymongo.errors import DuplicateKeyError
from structlog import get_logger

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

logger = get_logger("mongo")


async def migrate_status(mongo: "Mongo"):
    """Automatically update the status collection.

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
            },
        )
    except DuplicateKeyError:
        if await mongo.hmm.count_documents({}):
            await mongo.status.update_one(
                {"_id": "hmm", "installed": {"$exists": False}},
                {"$set": {"installed": None}},
            )
