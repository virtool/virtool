import json
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from virtool.references.utils import (
    ReferenceSourceData,
    load_reference_from_storage,
)
from virtool.tasks.task import BaseTask
from virtool.uploads.utils import upload_file_key

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

        self.steps = [self.load_file, self.import_reference]

        self.import_data: ReferenceSourceData | None = None

    async def load_file(self) -> None:
        key = upload_file_key(self.context["name_on_disk"])

        try:
            import_data = await load_reference_from_storage(
                self.data.references._storage,
                key,
            )
        except json.decoder.JSONDecodeError as err:
            return await self._set_error(str(err))
        except (OSError, EOFError) as err:
            if "Not a gzipped file" in str(err):
                await self._set_error("Not a gzipped file")
            else:
                await self._set_error(str(err))

            return None

        self.import_data = ReferenceSourceData.parse_obj(import_data)

        return None

    async def import_reference(self) -> None:
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        await self.data.references.populate_imported_reference(
            ref_id,
            user_id,
            self.import_data,
            self.create_progress_handler(),
        )
