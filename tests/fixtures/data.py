"""Fixtures for working with the Virtool data layer."""

import pytest
from aiohttp import ClientSession
from pytest_mock import MockerFixture
from redis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.layer import DataLayer, create_data_layer
from virtool.mongo.core import Mongo


@pytest.fixture
def data_layer(
    config,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    redis: Redis,
) -> DataLayer:
    """A complete data layer backed by testing instances of MongoDB, PostgreSQL, and
    Redis.

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
        redis,
    )
