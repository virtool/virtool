from __future__ import annotations

from tempfile import TemporaryDirectory
from typing import Dict

from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask


class TimeoutJobsTask(BaseTask):
    """
    Timeout dead jobs.

    Times out jobs that are in the running or preparing state and have either been
    running for more than 30 days or have a populated ping field and have not received a
    ping in the past 5 minutes.

    """

    name = "timeout_jobs"

    def __init__(
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.timeout_jobs]

    async def timeout_jobs(self):
        await self.data.jobs.timeout()
