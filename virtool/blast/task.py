from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class BLASTSweepTask(BaseTask):
    """Advance all outstanding NuVs BLAST searches against NCBI."""

    name = "sweep_blast"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.sweep]

    async def sweep(self) -> None:
        await self.data.blast.sweep()
