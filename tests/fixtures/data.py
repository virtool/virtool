"""Fixtures for working with the Virtool data layer."""

import pytest
from aiohttp import ClientSession
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.layer import DataLayer, create_data_layer
from virtool.mongo.core import Mongo
from virtool.storage.protocol import StorageBackend


@pytest.fixture
def data_layer(
    config,
    memory_storage: StorageBackend,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
) -> DataLayer:
    """A complete data layer backed by testing instances of MongoDB and PostgreSQL.

    Example:
    -------
    .. code-block:: python

        async def test_example(data_layer: DataLayer):
            await data_layer.samples.create(...)

    """
    return create_data_layer(
        mongo,
        pg,
        config,
        mocker.Mock(spec=ClientSession),
        memory_storage,
    )
