import pytest


@pytest.mark.parametrize("dev", [True, False])
async def test_dev_mode(dev, spawn_client):
    """
    Ensure that developer endpoint is not available when not in developer mode.
    """
    client = await spawn_client(authorize=True, dev=dev)

    resp = await client.post("/dev", {"command": "foo"})

    assert resp.status == 204 if dev else 404
