import hashlib
from http import HTTPStatus

from aiohttp import ClientResponse
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker


async def test_list(
    fake: DataFaker, snapshot: SnapshotAssertion, spawn_client: ClientSpawner
):
    """Test that a GET request to `/ml` returns a list of HMMs."""
    client = await spawn_client(authenticated=True)

    await fake.ml.populate()

    resp = await client.get("/ml")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(
        name="json",
        matcher=path_type({".*created_at": (str,)}, regex=True),
    )


async def test_get(
    fake: DataFaker, snapshot: SnapshotAssertion, spawn_client: ClientSpawner
):
    """Test that a GET request to `/ml/:id` returns the details for a model."""
    client = await spawn_client(authenticated=True)

    await fake.ml.populate()

    resp = await client.get("/ml/1")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(
        name="json",
        matcher=path_type({".*created_at": (str,)}, regex=True),
    )


async def test_download_release(fake: DataFaker, spawn_client: ClientSpawner):
    """Test that a GET request to `/ml/:id/releases/:id/model.tar.gz` returns a file
    download of the model archive for that release.
    """
    client = await spawn_client(authenticated=True)

    await fake.ml.populate()

    resp: ClientResponse = await client.get("/ml/1/releases/1/model.tar.gz")

    assert resp.status == HTTPStatus.OK

    body = await resp.read()

    assert len(body) == 11343772
    assert hashlib.md5(body).hexdigest() == "d6f611bec1a60a124c541137d296f16f"
