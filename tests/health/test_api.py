import pytest


async def test_is_alive(spawn_client):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/api/health/alive")

    assert resp.status == 200
    assert await resp.json() == {
        "alive": True
    }


@pytest.mark.parametrize("ready", [True, False])
async def test_is_ready(spawn_client, ready):
    client = await spawn_client(authorize=True, administrator=True)

    client.app["ready"] = ready
    resp = await client.get("/api/health/ready")

    if ready:
        assert resp.status == 200
        assert await resp.json() == {
            "ready": True
        }
    else:
        assert resp.status == 500
        assert await resp.json() == {
            "ready": False
        }
