"""Periodic tasks for cache maintenance."""

from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class LRUCacheEvictionTask(BaseTask):
    name = "evict_caches_lru"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.evict]

    async def evict(self) -> None:
        await self.data.caches.evict_lru()
