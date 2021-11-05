from virtool.settings.db import Settings, ensure


async def test_ensure(dbi, test_settings):
    settings = await ensure(dbi)

    assert settings == Settings(**{
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
        "software_channel": "stable"
    })
