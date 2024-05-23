from abc import ABC, abstractmethod

from virtool_core.redis import Redis

REDIS_TASKS_LIST_KEY = "tasks"
"""The key for the list used to queue tasks in Redis."""


class AbstractTasksClient(ABC):
    @abstractmethod
    async def enqueue(self, task_type: str, task_id: int): ...

    @abstractmethod
    async def pop(self) -> int: ...


class TasksClient(AbstractTasksClient):
    def __init__(self, redis: Redis):
        self._redis = redis

    async def enqueue(self, task_type: str, task_id: int):
        await self._redis.rpush(REDIS_TASKS_LIST_KEY, task_id)

    async def pop(self) -> int | None:
        return await self._redis.blpop(REDIS_TASKS_LIST_KEY)
