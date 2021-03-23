import asyncio
from asyncio import CancelledError

from aioredis import Redis


class TasksClient:

    def __init__(self, redis: Redis):
        self._redis = redis

    async def add(self, task_id):
        try:
            await self._redis.publish("channel:tasks", task_id)
        except CancelledError:
            pass

    async def add_periodic(self, task_id, interval):
        try:
            while True:
                await self._redis.publish("channel:tasks", task_id)
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
