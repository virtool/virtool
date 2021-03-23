import asyncio
from asyncio import CancelledError

from aioredis import Redis

from virtool.tasks.pg import register


class TasksClient:

    def __init__(self, redis: Redis, pg):
        self._redis = redis
        self.pg = pg

    async def add(self, task_class, context=None):
        try:
            row = await register(self.pg, task_class, context=context)
            await self._redis.publish("channel:tasks", row["id"])

            return row
        except CancelledError:
            pass

    async def add_periodic(self, task_class, interval, context=None):
        try:
            while True:
                row = await register(self.pg, task_class, context=context)

                await self._redis.publish("channel:tasks", row["id"])
                await asyncio.sleep(interval)

                return row
        except asyncio.CancelledError:
            pass
