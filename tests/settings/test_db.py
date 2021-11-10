from virtool.settings.db import Settings, ensure


async def test_ensure(dbi, snapshot, test_settings):
    settings = await ensure(dbi)

    assert settings == snapshot

    assert await dbi.settings.find_one() == snapshot
