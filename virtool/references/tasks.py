import json
from asyncio import to_thread
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from aiohttp import ClientConnectorError

from virtool.data.http import download_file
from virtool.references.utils import (
    ReferenceSourceData,
    load_reference_file,
)
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper
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

    async def clone(self):
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
        try:
            import_data = await to_thread(
                load_reference_file,
                Path(self.context["path"]),
            )
        except json.decoder.JSONDecodeError as err:
            return await self._set_error(str(err).split("JSONDecodeError: ")[1])
        except OSError as err:
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


class RemoteReferenceTask(BaseTask):
    name = "remote_reference"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.download, self.populate]

        self.import_data: ReferenceSourceData | None = None

    async def download(self):
        tracker = AccumulatingProgressHandlerWrapper(
            self.create_progress_handler(),
            self.context["release"]["size"],
        )

        path = self.temp_path / "reference.json.gz"

        try:
            await download_file(
                self.context["release"]["download_url"],
                path,
                tracker.add,
            )
        except ClientConnectorError:
            await self._set_error("Could not download reference data")

        from_json = await to_thread(load_reference_file, path)

        self.import_data = ReferenceSourceData(**from_json)

    async def populate(self):
        await self.data.references.populate_remote_reference(
            self.context["ref_id"],
            self.import_data,
            self.context["user_id"],
            self.context["release"],
            self.create_progress_handler(),
        )


class UpdateRemoteReferenceTask(BaseTask):
    name = "update_remote_reference"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.download, self.update]

        self.download_url = self.context["release"]["download_url"]
        self.download_size = self.context["release"]["size"]
        self.source_data: ReferenceSourceData | None = None

    async def download(self):
        tracker = AccumulatingProgressHandlerWrapper(
            self.create_progress_handler(),
            self.download_size,
        )

        path = self.temp_path / "reference.json.gz"

        try:
            await download_file(self.download_url, path, tracker.add)
        except ClientConnectorError:
            return await self._set_error("Could not download reference data")

        data = await to_thread(load_reference_file, path)

        self.source_data = ReferenceSourceData(**data)

    async def update(self):
        await self.data.references.update_remote_reference(
            self.context["ref_id"],
            self.source_data,
            self.context["release"],
            self.context["user_id"],
            self.create_progress_handler(),
        )


class ReferencesCleanTask(BaseTask):
    name = "clean_references"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.clean]

    async def clean(self):
        await self.data.references.clean_all()


class ReferenceReleasesRefreshTask(BaseTask):
    name = "refresh_reference_releases"

    def __init__(self, task_id: int, data: "DataLayer", context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.refresh_remote_releases]

    async def refresh_remote_releases(self):
        await self.data.references.fetch_and_update_reference_releases()
