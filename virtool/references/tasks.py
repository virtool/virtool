from __future__ import annotations
import json
from logging import getLogger
from pathlib import Path
from typing import Dict, Optional, TYPE_CHECKING

from aiohttp import ClientConnectorError
from humanfriendly.testing import TemporaryDirectory

from virtool.api.custom_json import dump_string
from virtool.errors import WebError
from virtool.http.utils import download_file
from virtool.references.utils import (
    check_import_data,
    load_reference_file,
    ReferenceSourceData,
)
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper
from virtool.tasks.task import BaseTask
from virtool.utils import run_in_thread

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

logger = getLogger(__name__)


class CloneReferenceTask(BaseTask):
    """
    Clone an existing reference.

    """

    name = "clone_reference"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.clone]

    async def clone(self):
        manifest = self.context["manifest"]
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        await self.data.references.populate_cloned_reference(
            manifest, ref_id, user_id, self.create_progress_handler()
        )


class ImportReferenceTask(BaseTask):
    name = "import_reference"

    def __init__(self, task_id: int, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [
            self.load_file,
            self.import_reference,
        ]

        self.import_data: Optional[ReferenceSourceData] = None

    async def load_file(self):
        path = Path(self.context["path"])

        try:
            import_data = await run_in_thread(load_reference_file, path)
        except json.decoder.JSONDecodeError as err:
            return await self._set_error(str(err).split("JSONDecodeError: ")[1])
        except OSError as err:
            if "Not a gzipped file" in str(err):
                return await self._set_error("Not a gzipped file")

            return await self._set_error(str(err))

        if errors := check_import_data(import_data, strict=False, verify=True):
            return await self._set_error(errors)

        self.import_data = ReferenceSourceData(**import_data)

    async def import_reference(self):
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
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.download, self.populate]

        self.import_data: Optional[ReferenceSourceData] = None

    async def download(self):
        tracker = AccumulatingProgressHandlerWrapper(
            self.create_progress_handler(), self.context["release"]["size"]
        )

        path = self.temp_path / "reference.json.gz"

        try:
            await download_file(
                self.context["release"]["download_url"], path, tracker.add
            )
        except (ClientConnectorError, WebError):
            await self._set_error("Could not download reference data")

        import_data = await run_in_thread(load_reference_file, path)

        if error := check_import_data(import_data, strict=True, verify=True):
            await self._set_error(dump_string(error))

        self.import_data = ReferenceSourceData(**import_data)

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
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [
            self.download,
            self.update,
        ]

        self.download_url = self.context["release"]["download_url"]
        self.download_size = self.context["release"]["size"]
        self.source_data: Optional[ReferenceSourceData] = None

    async def download(self):
        tracker = AccumulatingProgressHandlerWrapper(
            self.create_progress_handler(), self.download_size
        )

        path = self.temp_path / "reference.tar.gz"

        try:
            await download_file(self.download_url, path, tracker.add)
        except (ClientConnectorError, WebError):
            return await self._set_error("Could not download reference data")

        data = await run_in_thread(load_reference_file, path)

        self.source_data = ReferenceSourceData(**data)

    async def update(self):
        await self.data.references.update_remote_reference(
            self.context["ref_id"],
            self.source_data,
            self.context["release"],
            self.context["user_id"],
            self.create_progress_handler(),
        )


class CleanReferencesTask(BaseTask):
    name = "clean_references"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.clean]

    async def clean(self):
        await self.data.references.clean_all()
