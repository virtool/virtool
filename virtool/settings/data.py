from virtool_core.models.settings import Settings

from virtool.mongo.core import DB
from virtool.settings.db import update, ensure
from virtool.settings.oas import UpdateSettingsSchema

PROJECTION = {"_id": False}


class SettingsData:
    def __init__(self, db):
        self._db: DB = db

    async def get_all(self) -> Settings:
        """
        List all settings.

        :return: the application settings

        """

        settings = await self._db.settings.find_one(
            {"_id": "settings"}, projection=PROJECTION
        )

        if settings:
            return Settings(**settings)

        return {}

    async def update(self, data: UpdateSettingsSchema) -> Settings:
        """
        Update the settings.

        :param data: updates to the current settings
        :return: the application settings
        """

        return Settings(**await update(self._db, data.dict(exclude_unset=True)))

    async def ensure_default(self) -> Settings:
        """
        Ensure the settings document is updated and filled with default values.

        :return: a dictionary with settings data
        """
        return await ensure(self._db)
