import logging
from typing import Any, Dict
from virtool_core.models.settings import Settings

logger = logging.getLogger(__name__)

PROJECTION = {"_id": False}


async def ensure(db):
    """
    Ensure the settings document is updated and filled with default values.

    :param db: the application database client

    :return: a dictionary with settings data

    """
    existing = await db.settings.find_one({"_id": "settings"}, {"_id": False}) or {}

    settings = {**(Settings().dict()), **existing}
    settings.pop("_id", None)

    await db.settings.update_one({"_id": "settings"}, {"$set": settings}, upsert=True)

    return Settings(**settings)


async def get(db) -> Dict[str, Any]:
    """
    Get the complete document of settings with id `settings`.

    :param db: the application database client

    :return: the settings document or an empty dictionary

    """
    settings = await db.settings.find_one({"_id": "settings"}, projection=PROJECTION)

    if settings:
        settings.pop("_id", None)
        settings.pop("software_channel", None)
        return settings

    return {}


async def update(db, updates: dict) -> Dict[str, Any]:
    """
    Update settings document with id `settings`.

    :param db: the application database client
    :param updates: a dictionary with updated data

    :return: the settings document after updating

    """
    updated = await db.settings.find_one_and_update(
        {"_id": "settings"}, {"$set": updates}
    )

    updated.pop("_id", None)

    return updated
