import pytest
from aiohttp import ClientSession
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool.data.factory import create_data_layer


@pytest.fixture
async def data_layer(
    mongo, config, mocker, pg: AsyncEngine, redis: Redis, spawn_auth_client
):
    return create_data_layer(
        mongo,
        pg,
        config,
        mocker.Mock(spec=ClientSession),
        redis,
        await spawn_auth_client(skip_user=True),
    )
