from aioredis import Channel
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.listener import RedisDispatcherListener


def test_add_and_remove_connection(mocker, dbi, pg: AsyncEngine, test_channel: Channel):
    dispatcher = Dispatcher(pg, dbi, RedisDispatcherListener(test_channel))

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher._connections

    dispatcher.remove_connection(m)

    assert dispatcher._connections == []
