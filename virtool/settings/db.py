import logging

import virtool.settings.schema

logger = logging.getLogger(__name__)

PROJECTION = {
    "_id": False
}


async def ensure(db):
    """
    Ensure the settings document is updated and filled with default values.

    :param db: the application database client

    :return: a dictionary with settings data

    """
    existing = await db.settings.find_one({"_id": "settings"}, {"_id": False}) or dict()
    defaults = virtool.settings.schema.get_defaults()

    ensure_update = {
        **defaults,
        **existing
    }

    await db.settings.update_one({"_id": "settings"}, {
        "$set": ensure_update
    }, upsert=True)

    return ensure_update


async def get(db):
    """
    Get the complete document of settings with id `settings`.

    :param db: the application database client

    :return: the settings document or an empty dictionary

    """
    settings = await db.settings.find_one("settings", projection=PROJECTION)

    if settings:
        return settings

    return dict()


async def update(db, updates: dict):
    """
    Update settings document with id `settings`.

    :param db: the application database client
    :param updates: a dictionary with updated data

    :return: the settings document after updating

    """
    return await db.settings.find_one_and_update({"_id": "settings"}, {
        "$set": updates
    })
