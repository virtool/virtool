import pytest
from aiohttp import ClientSession
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool.data.factory import create_data_layer


@pytest.fixture
def data_layer(
    authorization_client, mongo, config, mocker, pg: AsyncEngine, redis: Redis
):
    return create_data_layer(
        authorization_client, mongo, pg, config, mocker.Mock(spec=ClientSession), redis
    )
