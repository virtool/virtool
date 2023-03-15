from aioredis import Redis, Channel
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.listener import RedisDispatcherListener


def test_add_and_remove_connection(
    mocker, mongo, pg: AsyncEngine, channel: Channel, redis: Redis
):
    dispatcher = Dispatcher(pg, mongo, RedisDispatcherListener(channel, redis))

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher._connections

    dispatcher.remove_connection(m)

    assert dispatcher._connections == []
