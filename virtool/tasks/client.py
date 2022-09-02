import asyncio
from asyncio import CancelledError
from typing import Type

from aioredis import Redis

from virtool.tasks.task import Task
from virtool.tasks.data import TasksData


class TasksClient:
    def __init__(self, redis: Redis, tasks_data: TasksData):
        self._redis = redis
        self.tasks_data = tasks_data

    async def add(self, task_class: Type[Task], context: dict = None):
        """
        Register a new task and store the task ID in redis.

        :param task_class: a subclass of a Virtool :class:`~virtool.tasks.task.Task`
        :param context: A dict containing data used by the task
        :return: the task record

        """
        try:
            registered_task = await self.tasks_data.register(task_class, context=context)
            await self._redis.publish("channel:tasks", registered_task.id)

            return registered_task
        except CancelledError:
            pass

    async def add_periodic(
        self, task_class: Task, interval: int = None, context: dict = None
    ):
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
                row = await self.tasks_data.register(task_class, context=context)

                await self._redis.publish("channel:tasks", row["id"])
                await asyncio.sleep(interval)

                return row
        except asyncio.CancelledError:
            pass
