"""Tasks for building reference indexes."""

from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class CreateIndexTask(BaseTask):
    """Create a reference index artifact."""

    name = "create_index"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ) -> None:
        """Initialize the task steps."""
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.build_index]

    async def build_index(self) -> None:
        """Generate the index artifact and mark the index ready."""
        await self.data.index.generate_task_index(self.context["index_id"])
