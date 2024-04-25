from virtool_core.models.settings import Settings

from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest


class SettingsData:
    name = "settings"

    def __init__(self, mongo: "Mongo"):
        self._mongo: Mongo = mongo

    async def get_all(self) -> Settings:
        """List all settings.

        :return: the application settings

        """
        settings = await self._mongo.settings.find_one(
            {"_id": "settings"},
            projection={"_id": False},
        )

        if settings is None:
            return Settings()

        return Settings(**settings)

    async def update(self, data: UpdateSettingsRequest) -> Settings:
        """Update the settings.

        :param data: updates to the current settings
        :return: the application settings
        """
        updated = await self._mongo.settings.find_one_and_update(
            {"_id": "settings"},
            {"$set": data.dict(exclude_unset=True)},
        )

        return Settings(**updated)

    async def ensure(self) -> Settings:
        """Ensure the settings document is updated and filled with default values.

        :return: the application settings
        """
        existing = await self.get_all()

        settings = {**(Settings().dict()), **existing.dict()}

        await self._mongo.settings.update_one(
            {"_id": "settings"},
            {"$set": settings},
            upsert=True,
        )

        return Settings(**settings)
