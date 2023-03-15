import pytest

from virtool_core.models.settings import Settings

from virtool.settings.data import SettingsData


@pytest.fixture
async def settings_data(mongo) -> SettingsData:
    return SettingsData(mongo)


async def test_ensure(mongo, settings_data: SettingsData, snapshot, test_settings):
    settings = await settings_data.ensure()

    assert settings == Settings(
        sample_group="none",
        sample_group_read=True,
        sample_group_write=False,
        sample_all_read=True,
        sample_all_write=False,
        sample_unique_names=True,
        hmm_slug="virtool/virtool-hmm",
        enable_api=True,
        enable_sentry=True,
        minimum_password_length=8,
        default_source_types=["isolate", "strain"],
    )

    assert await mongo.settings.find_one() == snapshot
