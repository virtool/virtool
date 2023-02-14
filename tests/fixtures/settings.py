import pytest


@pytest.fixture()
async def test_settings(mongo):
    await mongo.settings.delete_one({"_id": "settings"})

    await mongo.settings.insert_one(
        {
            "_id": "settings",
            "default_source_types": ["isolate", "strain"],
            "enable_api": True,
            "enable_sentry": True,
            "hmm_slug": "virtool/virtool-hmm",
            "minimum_password_length": 8,
            "sample_all_read": True,
            "sample_all_write": False,
            "sample_group": "none",
            "sample_group_read": True,
            "sample_group_write": False,
            "sample_unique_names": True,
        }
    )
