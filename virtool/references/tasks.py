import json
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

import aiofiles
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from structlog import get_logger

from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
    SQLiteReferenceReadError,
)
from virtool.references.utils import (
    ReferenceSourceData,
    load_reference_from_storage,
)
from virtool.tasks.task import BaseTask
from virtool.uploads.utils import upload_file_key

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

logger = get_logger("references.tasks")


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
        name_on_disk = self.context["name_on_disk"]
        key = upload_file_key(name_on_disk)

        if name_on_disk.endswith(".json.gz"):
            import_data = await self._load_json(key)
        elif name_on_disk.endswith(".v1.sqlite"):
            import_data = await self._load_sqlite(key)
        else:
            await self._set_error(
                "Unsupported reference file name; expected a .json.gz or "
                ".v1.sqlite suffix"
            )
            return

        if import_data is None:
            return

        try:
            self.import_data = ReferenceSourceData.parse_obj(import_data)
        except ValidationError as err:
            await self._set_error(f"Invalid reference data: {err}")

    async def _load_json(self, key: str) -> dict | None:
        try:
            return await load_reference_from_storage(
                self.data.references._storage,
                key,
            )
        except json.decoder.JSONDecodeError as err:
            await self._set_error(str(err))
        except (OSError, EOFError) as err:
            if "Not a gzipped file" in str(err):
                await self._set_error("Not a gzipped file")
            else:
                await self._set_error(str(err))

        return None

    async def _load_sqlite(self, key: str) -> dict | None:
        sqlite_path = self.temp_path / REFERENCE_SQLITE_FILE_NAME

        try:
            async with aiofiles.open(sqlite_path, "wb") as handle:
                async for chunk in self.data.references._storage.read(key):
                    await handle.write(chunk)

            sqlite_reference = SQLiteReference.load(sqlite_path)
            await sqlite_reference.validate()
            reference = await sqlite_reference.get_metadata()
            otus = [otu async for otu in sqlite_reference.iter_otus()]
        except (SQLiteReferenceReadError, SQLAlchemyError):
            logger.exception(
                "could not read SQLite reference database",
                task_id=self.task_id,
            )
            await self._set_error(
                "Invalid SQLite reference file: could not read the database"
            )
            return None
        except OSError:
            logger.exception(
                "could not read uploaded SQLite reference file",
                task_id=self.task_id,
            )
            await self._set_error("Could not read uploaded SQLite reference file")
            return None
        except ValueError as err:
            await self._set_error(f"Invalid SQLite reference file: {err}")
            return None

        return {**reference, "otus": otus}

    async def import_reference(self) -> None:
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        if self.import_data is None:
            msg = "Reference import data has not been loaded"
            raise RuntimeError(msg)

        await self.data.references.populate_imported_reference(
            ref_id,
            user_id,
            self.import_data,
            self.create_progress_handler(),
        )
