import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.settings.data import SettingsData
from virtool.settings.models import Settings
from virtool.settings.oas import UpdateSettingsRequest
from virtool.settings.sql import SQLSettings


@pytest.fixture
async def settings_data(pg: AsyncEngine) -> SettingsData:
    return SettingsData(pg)


async def seed_row(pg: AsyncEngine, **overrides) -> None:
    async with AsyncSession(pg) as session:
        await session.merge(SQLSettings(id=1, **{**Settings().dict(), **overrides}))
        await session.commit()


class TestGetAll:
    async def test_ok(self, pg: AsyncEngine, settings_data: SettingsData):
        await seed_row(pg, enable_api=True, minimum_password_length=12)

        assert await settings_data.get_all() == Settings(
            enable_api=True,
            minimum_password_length=12,
        )

    async def test_missing_row_raises(self, settings_data: SettingsData):
        with pytest.raises(ResourceNotFoundError):
            await settings_data.get_all()


class TestUpdate:
    async def test_ok(self, pg: AsyncEngine, settings_data: SettingsData):
        await seed_row(pg)

        settings = await settings_data.update(
            UpdateSettingsRequest(enable_api=True, minimum_password_length=10),
        )

        assert settings.enable_api is True
        assert settings.minimum_password_length == 10
        assert await settings_data.get_all() == settings

    async def test_missing_row_raises(self, settings_data: SettingsData):
        with pytest.raises(ResourceNotFoundError):
            await settings_data.update(UpdateSettingsRequest(enable_api=True))

    async def test_empty_returns_current(
        self,
        pg: AsyncEngine,
        settings_data: SettingsData,
    ):
        await seed_row(pg, enable_api=True, minimum_password_length=16)

        settings = await settings_data.update(UpdateSettingsRequest())

        assert settings == Settings(enable_api=True, minimum_password_length=16)

    async def test_empty_missing_row_raises(self, settings_data: SettingsData):
        with pytest.raises(ResourceNotFoundError):
            await settings_data.update(UpdateSettingsRequest())


class TestEnsure:
    async def test_seeds_defaults_when_missing(self, settings_data: SettingsData):
        settings = await settings_data.ensure()

        assert settings == Settings()
        assert await settings_data.get_all() == Settings()

    async def test_preserves_existing_row(
        self,
        pg: AsyncEngine,
        settings_data: SettingsData,
    ):
        await seed_row(pg, enable_api=True, minimum_password_length=16)

        settings = await settings_data.ensure()

        assert settings == Settings(enable_api=True, minimum_password_length=16)
