import logging
from dataclasses import asdict
from dataclasses import dataclass, field
from typing import Any, Dict

logger = logging.getLogger(__name__)

PROJECTION = {"_id": False}


@dataclass
class Settings:
    sample_group: str = None
    sample_group_read: bool = True
    sample_group_write: bool = False
    sample_all_read: bool = True
    sample_all_write: bool = False
    sample_unique_names: bool = True
    hmm_slug: str = "virtool/virtool-hmm"
    enable_api: bool = False
    enable_sentry: bool = True
    software_channel: str = "stable"
    minimum_password_length: int = 8
    default_source_types: list = field(default_factory=lambda: ["isolate", "strain"])


async def ensure(db):
    """
    Ensure the settings document is updated and filled with default values.

    :param db: the application database client

    :return: a dictionary with settings data

    """
    existing = await db.settings.find_one({"_id": "settings"}, {"_id": False}) or dict()

    settings = {**asdict(Settings()), **existing}
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
        return settings

    return dict()


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
