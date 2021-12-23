from typing import AsyncIterable

from aioredis import Channel

from virtool.dispatcher.change import Change


class RedisDispatcherListener(AsyncIterable):
    """
    Asynchronously iterates through messages on a Redis Pub/Sub channel returning :class:`.Change`
    objects.

    """

    def __init__(self, channel: Channel):
        self._channel = channel

    def __aiter__(self):
        return self

    async def __anext__(self) -> Change:
        """
        Get the next JSON-encoded message from the channel and return it as a :class:`Change`
        object.

        :return: the change derived from the incoming JSON object

        """
        change = await self._channel.get_json()

        return Change(change["interface"], change["operation"], change["id_list"])
