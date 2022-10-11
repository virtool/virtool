from tempfile import TemporaryDirectory
from typing import Dict

from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask


class StoreNuvsFilesTask(BaseTask):
    name = "store_nuvs_files"

    def __init__(
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.store_nuvs_files]

    async def store_nuvs_files(self):
        """
        Move existing NuVs analysis files to `<data_path>`/analyses/:id and remove the
        old directory.

        """
        await self.data.analyses.store_nuvs_files(self.create_progress_handler())
