import hashlib

from aiohttp import ClientResponse
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker


async def test_list(fake2, snapshot, spawn_client):
    """Test that a GET request to `/ml` returns a list of HMMs."""
    client = await spawn_client(authenticated=True)

    await fake2.ml.populate()

    resp = await client.get("/ml")

    assert resp.status == 200
    assert await resp.json() == snapshot(
        name="json",
        matcher=path_type({".*created_at": (str,)}, regex=True),
    )


async def test_get(fake2, snapshot, spawn_client):
    """Test that a GET request to `/ml/:id` returns the details for a model."""
    client = await spawn_client(authenticated=True)

    await fake2.ml.populate()

    resp = await client.get("/ml/1")

    assert resp.status == 200
    assert await resp.json() == snapshot(
        name="json",
        matcher=path_type({".*created_at": (str,)}, regex=True),
    )


async def test_download_release(fake2: DataFaker, spawn_client: ClientSpawner):
    """Test that a GET request to `/ml/:id/releases/:id/model.tar.gz` returns a file
    download of the model archive for that release.
    """
    client = await spawn_client(authenticated=True)

    await fake2.ml.populate()

    resp: ClientResponse = await client.get("/ml/1/releases/1/model.tar.gz")

    assert resp.status == 200

    body = await resp.read()

    assert len(body) == 413211
    assert hashlib.md5(body).hexdigest() == "f6758c2351a5b662464d612780deea0d"
