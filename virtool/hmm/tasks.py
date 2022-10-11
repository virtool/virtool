import json
import logging
import shutil

import aiofiles
from virtool_core.utils import decompress_tgz

from virtool.http.utils import download_file
from virtool.tasks.progress import DownloadProgressHandlerWrapper
from virtool.tasks.task import BaseTask
from virtool.utils import run_in_thread

logger = logging.getLogger(__name__)


class HMMInstallTask(BaseTask):
    """
    Runs a background Task that:
        - downloads the official profiles.hmm.gz file
        - decompresses the vthmm.tar.gz file
        - moves the file to the correct data path
        - downloads the official annotations.json.gz file
        - imports the annotations into the database

    Task reports the following stages to the hmm_install status document:
        1. download
        3. decompress
        4. install_profiles
        5. import_annotations

    """

    task_type = "install_hmms"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [
            self.download,
            self.decompress,
            self.install_profiles,
            self.install_annotations,
        ]

    async def download(self):
        """
        Download the HMM release archive.

        TODO: Replace or fix usage of download_file()
        """
        release = self.context["release"]

        tracker = DownloadProgressHandlerWrapper(
            self.create_progress_handler(), release["size"]
        )

        try:
            await download_file(
                self.app,
                release["download_url"],
                self.temp_path / "hmm.tar.gz",
                tracker.add,
            )
        except Exception as err:
            logger.warning("Request for HMM release encountered exception: %s", err)
            await self.error("Could not download HMM data.")

    async def decompress(self):
        await run_in_thread(
            decompress_tgz, self.temp_path / "hmm.tar.gz", self.temp_path
        )

    async def install_profiles(self):
        """
        Move the HMM profile file to its application data location.

        TODO: Deal with configuration for data_path.

        """
        await run_in_thread(
            shutil.move,
            self.temp_path / "hmm" / "profiles.hmm",
            self.data.hmms.profiles_path,
        )

    async def install_annotations(self):

        async with aiofiles.open(self.temp_path / "hmm" / "annotations.json", "r") as f:
            annotations = json.loads(await f.read())

        await self.data.hmms.install_annotations(
            annotations,
            self.context["release"],
            self.context["user_id"],
            self.create_progress_handler(),
        )

    async def cleanup(self):
        await self.data.hmms.purge()
