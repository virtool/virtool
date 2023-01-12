from typing import Dict, TYPE_CHECKING

from humanfriendly.testing import TemporaryDirectory

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class SyncPermissionsTask(BaseTask):
    """
    Sync group permissions with OpenFGA.
    """

    name = "sync_permissions"

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
        await self.data.auth.sync()
