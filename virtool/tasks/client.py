import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List

from aioredis import (
    Redis,
    ConnectionClosedError,
)

REDIS_TASKS_LIST_KEY = "tasks"
logging.getLogger("tasksClient")


class AbstractTasksClient(ABC):
    @abstractmethod
    async def enqueue(self, task_type: str, task_id: int):
        ...

    @abstractmethod
    async def pop(self) -> int:
        ...


class TasksClient(AbstractTasksClient):
    def __init__(self, redis: Redis):
        self.redis = redis

    async def enqueue(self, task_type: str, task_id: int):
        await self.redis.rpush(REDIS_TASKS_LIST_KEY, task_id)

    async def pop(self) -> int:
        result = await self._blpop(self.redis)

        if result is not None:
            return int(result[1])

    @staticmethod
    async def _blpop(redis: Redis):
        while True:
            try:
                with await redis as exclusive_redis:
                    return await exclusive_redis.blpop(REDIS_TASKS_LIST_KEY)
            except (
                ConnectionRefusedError,
                ConnectionResetError,
                ConnectionClosedError,
            ):
                await asyncio.sleep(5)


class DummyTasksClient(AbstractTasksClient):
    def __init__(
        self,
        task_list: List = None,
    ):
        self.task_list = task_list or []

    async def enqueue(self, task_type: str, task_id: int):
        self.task_list.append(task_id)

    async def pop(self) -> int:
        return self.task_list.pop(0)
