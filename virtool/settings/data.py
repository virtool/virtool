
from virtool_core.models.settings import Settings

from virtool.mongo.core import DB
from virtool.settings.db import get, update
from virtool.settings.oas import UpdateSettingsSchema


class SettingsData:
    def __init__(self, db):
        self._db: DB = db

    async def get_all(self) -> Settings:
        """
        List all settings.

        :return: settings object

        """

        settings = Settings(**await get(self._db))

        return settings

    async def update(self, data: UpdateSettingsSchema) -> Settings:
        """
        Update the settings.

        :param data: updates to the current settings
        :return: the settings
        """

        data = data.dict(exclude_unset=True)

        settings = await update(self._db, data)

        settings.pop("software_channel", None)

        settings = Settings(**settings)

        return settings
