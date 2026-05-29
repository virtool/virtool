"""PostgreSQL-based application settings data layer."""

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.settings.models import Settings
from virtool.settings.oas import UpdateSettingsRequest
from virtool.settings.sql import SQLSettings


class SettingsData:
    """PostgreSQL-based application settings data layer."""

    name = "settings"

    def __init__(self, pg: AsyncEngine) -> None:
        """Initialize the settings data layer domain."""
        self._pg = pg

    async def get_all(self) -> Settings:
        """List all settings.

        :raises ResourceNotFoundError: if the settings row does not exist
        :return: the application settings
        """
        async with AsyncSession(self._pg) as session:
            settings = (
                await session.execute(select(SQLSettings).where(SQLSettings.id == 1))
            ).scalar()

        if settings is None:
            raise ResourceNotFoundError

        return Settings(**settings.to_dict())

    async def update(self, data: UpdateSettingsRequest) -> Settings:
        """Update the settings.

        :param data: updates to the current settings
        :raises ResourceNotFoundError: if the settings row does not exist
        :return: the application settings
        """
        update_data = data.dict(exclude_unset=True)

        if not update_data:
            return await self.get_all()

        async with AsyncSession(self._pg) as session:
            updated = (
                await session.execute(
                    update(SQLSettings)
                    .where(SQLSettings.id == 1)
                    .values(**update_data)
                    .returning(SQLSettings),
                )
            ).scalar()

            if updated is None:
                raise ResourceNotFoundError

            settings = Settings(**updated.to_dict())
            await session.commit()

        return settings

    async def ensure(self) -> Settings:
        """Ensure the singleton settings row exists, seeding defaults if absent.

        Virgin deployments may not have run the table-seeding migration, so this
        inserts the default row when it is missing and leaves an existing row
        untouched.

        :return: the application settings
        """
        async with AsyncSession(self._pg) as session:
            await session.execute(
                insert(SQLSettings)
                .values(id=1, **Settings().dict())
                .on_conflict_do_nothing(index_elements=["id"]),
            )
            await session.commit()

        return await self.get_all()
