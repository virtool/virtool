import asyncio
import sys
from typing import AsyncIterable, AsyncGenerator

from aioredis import Channel, ChannelClosedError, Redis

from virtool.dispatcher.change import Change

from virtool_core.redis import resubscribe

from logging import getLogger

logger = getLogger(__name__)


class RedisDispatcherListener(AsyncIterable):
    """
    Asynchronously iterates through messages on a Redis Pub/Sub channel
    returning :class:`.Change` objects.

    """

    def __init__(self, redis: Redis, channel_name: str):
        self._redis = redis
        self._channel_name = channel_name
        self._channel = None

    def __aiter__(self):
        return self

    async def __anext__(self) -> Channel:
        """
        Get the next JSON-encoded message from the channel and yield
        it as a :class:`Change` object.

        :return: the change derived from the incoming JSON object

        """
        if not self._channel:
            (self._channel,) = await self._redis.subscribe(self._channel_name)
        while True:
            try:
                change = await self._channel.get_json()
                return Change(change["interface"], change["operation"], change["id_list"])
            except ChannelClosedError:
                try:
                    self._channel = await asyncio.wait_for(resubscribe(self._redis, self._channel_name), 10)
                except asyncio.TimeoutError:
                    logger.fatal("Could not resubscribe to redis %s", self._channel_name)
                    sys.exit(1)
            except TypeError:
                pass
