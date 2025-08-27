from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class JobsCleanTask(BaseTask):
    """Relist jobs."""

    name = "clean_jobs"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.clean_jobs]

    async def clean_jobs(self) -> None:
        """Clean up all jobs."""
        await self.data.jobs.clean()
