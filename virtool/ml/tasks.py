"""Tasks for downloading and installing machine learning models used in Virtool."""

from tempfile import TemporaryDirectory
from typing import Dict, TYPE_CHECKING


if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

from virtool.tasks.task import BaseTask


class SyncMLModelsTask(BaseTask):
    name = "sync_ml_models"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.sync]

    async def sync(self):
        """Sync the local models with www.virtool.ca and the releases on GitHub."""
        await self.data.ml.sync()
