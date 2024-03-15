import asyncio
from abc import ABC, abstractmethod

from virtool_core.redis import Redis, ConnectionClosedError

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
        await self.redis.rpush(REDIS_TASKS_LIST_KEY, task_id)

    async def pop(self) -> int:
        result = await self._blpop()

        if result is not None:
            return int(result[1])

    async def _blpop(self):
        while True:
            try:
                with await self.redis as exclusive_redis:
                    return await exclusive_redis.blpop(REDIS_TASKS_LIST_KEY)
            except (
                ConnectionRefusedError,
                ConnectionResetError,
                ConnectionClosedError,
            ):
                await asyncio.sleep(5)
