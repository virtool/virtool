import hashlib
from http import HTTPStatus

from aiohttp import ClientResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.ml.pg import SQLMLModelRelease


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


async def test_download_release(
    example_path,
    fake: DataFaker,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
):
    """Test that a GET request to `/ml/:id/releases/:id/model.tar.gz` returns a file
    download of the model archive for that release.
    """
    client = await spawn_client(authenticated=True)

    await fake.ml.populate()

    model_bytes = (example_path / "ml/model.tar.gz").read_bytes()

    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLMLModelRelease)
            .where(SQLMLModelRelease.id == 1)
            .values(size=len(model_bytes)),
        )
        await session.commit()

    async def _data():
        yield model_bytes

    await client.app["storage"].write("ml/1/model.tar.gz", _data())

    resp: ClientResponse = await client.get("/ml/1/releases/1/model.tar.gz")

    assert resp.status == HTTPStatus.OK

    body = await resp.read()

    assert len(body) == 11343772
    assert hashlib.md5(body).hexdigest() == "d6f611bec1a60a124c541137d296f16f"
