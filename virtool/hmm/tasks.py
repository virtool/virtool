import json
import logging
import shutil
from pathlib import Path

import aiofiles
import aiohttp

import virtool.errors
import virtool.github
import virtool.http.utils
import virtool.tasks.pg
import virtool.tasks.task
import virtool.utils

from virtool.hmm.db import purge

logger = logging.getLogger(__name__)


class HMMInstallTask(virtool.tasks.task.Task):
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

    :param app: the app object
    :param task_id: the id for the process document

    """
    task_type = "install_hmms"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.download,
            self.decompress,
            self.install_profiles,
            self.import_annotations
        ]

        self.temp_path = Path(self.temp_dir.name)

    async def download(self):
        release = self.context["release"]
        await virtool.tasks.pg.update(self.pg, self.id, 0, step="download")

        tracker = await self.get_tracker(release["size"])

        path = self.temp_path / "hmm.tar.gz"

        try:
            await virtool.http.utils.download_file(
                self.app,
                release["download_url"],
                path,
                tracker.add
            )
        except Exception as err:
            logger.warning(f"Request for HMM release encountered exception: {err}")
            await self.error("Could not download HMM data.")

    async def decompress(self):
        tracker = await self.get_tracker()

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.step_completed,
            step="unpack"
        )

        await self.run_in_thread(
            virtool.utils.decompress_tgz,
            self.temp_path / "hmm.tar.gz",
            self.temp_path
        )

    async def install_profiles(self):
        tracker = await self.get_tracker()

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.step_completed,
            step="install_profiles"
        )

        decompressed_path = self.temp_path / "hmm"

        install_path = self.app["settings"]["data_path"] / "hmm" / "profiles.hmm"

        await self.run_in_thread(shutil.move, decompressed_path / "profiles.hmm", install_path)

    async def import_annotations(self):
        release = self.context["release"]
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="import_annotations"
        )

        async with aiofiles.open(self.temp_path / "hmm" / "annotations.json", "r") as f:
            annotations = json.loads(await f.read())

        await purge(self.db, self.app["settings"])

        tracker = await self.get_tracker(len(annotations))

        for annotation in annotations:
            await self.db.hmm.insert_one(dict(annotation, hidden=False))
            await tracker.add(1)

        logger.debug(f"Inserted {len(annotations)} annotations")

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        await self.db.status.update_one({"_id": "hmm", "updates.id": release_id}, {
            "$set": {
                "installed": virtool.github.create_update_subdocument(release, True, self.context["user_id"]),
                "updates.$.ready": True
            }
        })

    async def cleanup(self):
        await purge(self.db, self.app["settings"])
