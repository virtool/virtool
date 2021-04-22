import asyncio
from asyncio import CancelledError

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.tasks.pg import register
from virtool.tasks.task import Task


class TasksClient:

    def __init__(self, redis: Redis, pg: AsyncEngine):
        self._redis = redis
        self.pg = pg

    async def add(self, task_class: Task, context: dict = None):
        """
        Register a new task and store the task ID in redis.

        :param task_class: a subclass of a Virtool :class:`~virtool.tasks.task.Task`
        :param context: A dict containing data used by the task
        :return: the task record

        """
        try:
            row = await register(self.pg, task_class, context=context)
            await self._redis.publish("channel:tasks", row["id"])

            return row
        except CancelledError:
            pass

    async def add_periodic(self, task_class: Task, interval: int = None, context: dict = None):
        """
        Register a new task that will be run regularly at the given interval.

        Store the task ID in redis.

        :param task_class: a subclass of a Virtool :class:`~virtool.tasks.task.Task`
        :param interval: a time interval
        :param context:A dict containing data used by the task
        :return: the task record

        """
        try:
            while True:
                row = await register(self.pg, task_class, context=context)

                await self._redis.publish("channel:tasks", row["id"])
                await asyncio.sleep(interval)

                return row
        except asyncio.CancelledError:
            pass
