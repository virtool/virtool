from aiohttp.test_utils import make_mocked_coro


async def test_get(mocker, spawn_client):
    return_value = {
        "test": "foobar",
        "baz": 12
    }

    # Mock attach_virus_name() to return arbitrary value.
    m_attach_virus_name = make_mocked_coro(return_value)
    mocker.patch("virtool.app_settings.attach_virus_name", new=m_attach_virus_name)

    client = await spawn_client(authorize=True)

    resp = await client.get("/api/settings")

    assert resp.status == 200
    assert await resp.json() == return_value

    # Make sure attach_virus_name() was called the the instance db client and setting object.
    m_attach_virus_name.assert_called_with(client.app["db"], client.app["settings"])
