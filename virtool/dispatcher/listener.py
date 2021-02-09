from abc import ABC, abstractmethod
from typing import AsyncGenerator

from aioredis import Channel

from virtool.dispatcher.message import Message


class AbstractDispatcherListener(ABC):

    @abstractmethod
    async def get(self) -> AsyncGenerator[Message, None]:
        """
        Get the next message to dispatch.
        """
        pass


class RedisDispatcherListener(AbstractDispatcherListener):

    def __init__(self, channel: Channel):
        self.channel = channel

    async def get(self) -> AsyncGenerator[Message, None]:
        while True:
            message = await self.channel.get_json()

            if message is not None:
                yield Message(
                    message["interface"],
                    message["operation"],
                    message["id_list"]
                ) 