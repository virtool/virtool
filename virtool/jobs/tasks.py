from __future__ import annotations

from tempfile import TemporaryDirectory
from typing import Dict, TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class TimeoutJobsTask(BaseTask):
    """
    Timeout dead jobs.

    Times out jobs that are in the running or preparing state and have either been
    running for more than 30 days or have a populated ping field and have not received a
    ping in the past 5 minutes.

    """

    name = "timeout_jobs"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.timeout_jobs]

    async def timeout_jobs(self):
        await self.data.jobs.timeout()


class RelistJobsTask(BaseTask):
    """
    relist jobs in redis

    Relists jobs in redis that are in the waiting state and are no longer in redis

    """

    name = "relist_jobs"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.relist_jobs]

    async def relist_jobs(self):
        await self.data.jobs.relist()
