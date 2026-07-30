from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class CloneReferenceTask(BaseTask):
    """Clone an existing reference."""

    name = "clone_reference"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.clone]

    async def clone(self) -> None:
        await self.data.references.populate_cloned_reference(
            self.context["manifest"],
            self.context["ref_id"],
            self.context["user_id"],
            self.create_progress_handler(),
        )


class ImportReferenceTask(BaseTask):
    name = "import_reference"

    def __init__(self, task_id: int, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.import_reference]

    async def import_reference(self) -> None:
        await self.data.references.import_reference(
            self.context["name_on_disk"],
            self.context["ref_id"],
            self.context["user_id"],
            self.temp_path,
            self.create_progress_handler(),
        )
