from tempfile import TemporaryDirectory
from typing import Dict

from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask


class PromoteAdministratorsTask(BaseTask):
    name = "promote_administrators"

    def __init__(
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.promote_administrators]

    async def promote_administrators(self):
        """
        Move existing NuVs analysis files to `<data_path>`/analyses/:id and remove the
        old directory.

        """
        await self.data.administrators.promote_administrators()
