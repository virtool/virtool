import logging
import pymongo.errors

logger = logging.getLogger(__name__)


async def initialize(db):
    try:
        await db.settings.insert_one({
            "_id": "settings",
            "enable_sentry": {"type": "boolean", "default": True},
            "sample_group": "none",
            "sample_group_read": True,
            "sample_group_write": False,
            "sample_all_read": True,
            "sample_all_write": False,
            "sample_unique_names": True,
            "hmm_slug": "virtool/virtool-hmm",
            "software_channel": "stable",
            "minimum_password_length": 8,
            "default_source_types": ["isolate", "strain"]
        })
    except pymongo.errors.DuplicateKeyError:
        logger.debug("Settings collection already initialized.")


async def update(db, updates):
    return await db.settings.find_one_and_update({"_id": "settings"}, {
        "$set": updates
    })
