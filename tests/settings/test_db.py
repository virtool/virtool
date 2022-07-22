from virtool.settings.db import Settings, ensure


async def test_ensure(dbi, snapshot, test_settings):
    settings = await ensure(dbi)

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

    assert await dbi.settings.find_one() == snapshot
