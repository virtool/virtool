async def test_get(spawn_client, test_settings):
    client = await spawn_client(authorize=True)

    resp = await client.get("/api/settings")

    assert resp.status == 200

    assert await resp.json() == {
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
    }


async def test_update(spawn_client, test_settings):
    client = await spawn_client(authorize=True, administrator=True)

    data = {
        "enable_api": False,
        "enable_sentry": False,
        "minimum_password_length": 10
    }

    resp = await client.patch("/api/settings", data)

    assert resp.status == 200

    assert await resp.json() == {
        "_id": "settings",
        "default_source_types": ["isolate", "strain"],
        "enable_api": False,
        "enable_sentry": False,
        "hmm_slug": "virtool/virtool-hmm",
        "minimum_password_length": 10,
        "sample_all_read": True,
        "sample_all_write": False,
        "sample_group": "none",
        "sample_group_read": True,
        "sample_group_write": False,
        "sample_unique_names": True,
        "software_channel": "stable"
    }
