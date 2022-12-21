from tempfile import TemporaryDirectory
from typing import Dict

from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask


class MigrateFilesTask(BaseTask):
    name = "migrate_files"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.migrate_to_postgres]

    async def migrate_to_postgres(self):
        """
        Transforms documents in the `files` collection into rows in the `uploads` SQL table.

        """
        await self.data.uploads.migrate_to_postgres()
