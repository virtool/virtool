"""Fixtures for working with the Virtool data layer."""

import pytest
from aiohttp import ClientSession
from pytest_mock import MockerFixture
from redis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.authorization.client import AuthorizationClient
from virtool.data.layer import DataLayer, create_data_layer
from virtool.mongo.core import Mongo
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData


@pytest.fixture()
def data_layer(
    authorization_client: AuthorizationClient,
    config,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    redis: Redis,
) -> DataLayer:
    """A complete data layer backed by testing instances of MongoDB, PostgreSQL, OpenFGA,
    and Redis.

    Example:
    -------
    .. code-block:: python

        async def test_example(data_layer: DataLayer):
            await data_layer.samples.create(...)

    """
    return create_data_layer(
        authorization_client,
        mongo,
        pg,
        config,
        mocker.Mock(spec=ClientSession),
        redis,
    )


@pytest.fixture()
async def tasks_data(pg: AsyncEngine, redis: Redis) -> TasksData:
    return TasksData(pg, TasksClient(redis))
