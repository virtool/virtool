"""Fixtures for working with the Virtool data layer."""

import pytest
from aiohttp import ClientSession
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.layer import DataLayer, create_data_layer
from virtool.identifier import AbstractIdProvider
from virtool.storage.protocol import StorageBackend


@pytest.fixture
async def data_layer(
    config,
    memory_storage: StorageBackend,
    mocker: MockerFixture,
    id_provider: AbstractIdProvider,
    pg: AsyncEngine,
) -> DataLayer:
    """A complete data layer backed by a testing instance of PostgreSQL.

    The singleton settings row is seeded to mirror application startup, which
    always calls ``settings.ensure()`` before serving requests.

    Example:
    -------
    .. code-block:: python

        async def test_example(data_layer: DataLayer):
            await data_layer.samples.create(...)

    """
    layer = create_data_layer(
        pg,
        config,
        mocker.Mock(spec=ClientSession),
        memory_storage,
        id_provider,
    )

    await layer.settings.ensure()

    return layer
