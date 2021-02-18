import asyncio
import json
from asyncio import CancelledError
from typing import Sequence, Union

from aioredis import Redis

from virtool.dispatcher.operations import Operation


class RedisDispatcherClient:

    def __init__(self, redis: Redis):
        self._redis = redis
        self._q = asyncio.Queue()

    async def run(self):
        """
        Run the dispatcher.

        Continually publishes enqueued changes to a Redis channel.

        """
        try:
            while True:
                json_string = await self._q.get()
                await self._redis.publish("channel:dispatch", json_string)
        except CancelledError:
            pass

    def enqueue_change(
            self,
            interface: str,
            operation: Operation,
            id_list: Sequence[Union[str, int]]
    ):
        """
        Enqueue the description of a change to be processed by a dispatcher.

        :param interface: the interface the change is on (eg. samples)
        :param operation: the operation the change represents (eg. update)
        :param id_list: the IDs of the resources changed

        """
        json_string = json.dumps({
            "interface": interface,
            "operation": operation,
            "id_list": id_list
        })

        self._q.put_nowait(json_string)