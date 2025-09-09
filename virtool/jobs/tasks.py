from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class JobsTimeoutTask(BaseTask):
    """Timeout stalled jobs."""

    name = "timeout_jobs"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.timeout_jobs]

    async def timeout_jobs(self) -> None:
        """Timeout stalled jobs."""
        await self.data.jobs.timeout_stalled_jobs()
