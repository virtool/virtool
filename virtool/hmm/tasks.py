import json
import logging
from asyncio import to_thread
from tempfile import TemporaryDirectory
from typing import Dict, TYPE_CHECKING

import aiofiles
from structlog import get_logger
from virtool_core.utils import decompress_tgz

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

from virtool.http.utils import download_file
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper
from virtool.tasks.task import BaseTask

logger = get_logger("hmms")


class HMMInstallTask(BaseTask):
    """
    Runs a background Task that:
        - downloads the official profiles.hmm.gz file
        - decompresses the hmm.tar.gz file
        - moves the file to the correct data path
        - downloads the official annotations.json.gz file
        - imports the annotations into the database

    Task reports the following stages to the hmm_install status document:
        1. download
        3. decompress
        4. install_profiles
        5. import_annotations

    """

    name = "install_hmms"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [
            self.download,
            self.decompress,
            self.install,
        ]

    async def download(self):
        """
        Download the HMM release archive.

        """
        release = self.context["release"]

        tracker = AccumulatingProgressHandlerWrapper(
            self.create_progress_handler(), release["size"]
        )

        try:
            await download_file(
                release["download_url"],
                self.temp_path / "hmm.tar.gz",
                tracker.add,
            )
        except Exception:
            logger.exception(
                "Exception during request for HMM release",
            )
            await self._set_error("Could not download HMM data.")

    async def decompress(self):
        await to_thread(decompress_tgz, self.temp_path / "hmm.tar.gz", self.temp_path)

    async def install(self):
        async with aiofiles.open(self.temp_path / "hmm" / "annotations.json", "r") as f:
            annotations = json.loads(await f.read())

        await self.data.hmms.install(
            annotations,
            self.context["release"],
            self.context["user_id"],
            self.create_progress_handler(),
            self.temp_path / "hmm" / "profiles.hmm",
        )

    async def cleanup(self):
        await self.data.hmms.clean_status()


class HMMRefreshTask(BaseTask):
    """
    Periodically refreshes the release information for HMMs.
    """

    name = "refresh_hmms"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context,
        temp_dir,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.refresh]

    async def refresh(self):
        await self.data.hmms.update_release()
