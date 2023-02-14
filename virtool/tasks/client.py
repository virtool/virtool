import logging
from abc import ABC, abstractmethod
from typing import List

from aioredis import Redis

REDIS_TASKS_LIST_KEY = "tasks"


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
        logging.info(task_id)
        await self.redis.rpush(REDIS_TASKS_LIST_KEY, task_id)

    async def pop(self) -> int:
        with await self.redis as redis:
            result = await redis.blpop(REDIS_TASKS_LIST_KEY)

            if result is not None:
                return int(result[1])


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
