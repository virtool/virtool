import pytest
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.config import get_config_from_app
from virtool.mongo.core import Mongo


@pytest.mark.parametrize("dev", [True, False])
@pytest.mark.parametrize("first_user", [True, False])
async def test_get(
    dev, first_user, mongo: Mongo, spawn_client: ClientSpawner, snapshot
):
    client = await spawn_client(authenticated=False)
    get_config_from_app(client.app).dev = dev

    if first_user:
        await mongo.users.delete_one({})

    resp = await client.get("/")

    as_json = await resp.json()

    assert as_json == snapshot(matcher=path_type({"version": (str,)}))
    assert as_json["version"] == client.app["version"]
