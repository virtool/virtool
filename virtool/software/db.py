import asyncio
import json
import logging
import os

import aiohttp

import virtool.db.utils
import virtool.http.proxy
import virtool.http.utils
import virtool.tasks.pg
import virtool.tasks.task
import virtool.software.utils
import virtool.software.utils
import virtool.utils

logger = logging.getLogger(__name__)

VIRTOOL_RELEASES_URL = "https://www.virtool.ca/releases4"


class SoftwareInstallTask(virtool.tasks.task.Task):

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.download,
            self.decompress,
            self.check_tree,
            self.copy_files,
        ]

        self.temp_path = self.temp_dir.name

    async def download(self):
        release = self.context["release"]

        # Download the release from GitHub and write it to a temporary directory.
        compressed_path = os.path.join(self.temp_path, "release.tar.gz")

        tracker = await self.get_tracker(release["size"])

        try:
            await virtool.http.utils.download_file(
                self.app,
                release["download_url"],
                compressed_path,
                progress_handler=tracker.add
            )
        except FileNotFoundError:
            await virtool.tasks.pg.update(self.pg, self.id, error="Could not write to release download location")

    async def decompress(self):
        tracker = await self.get_tracker()
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.initial + tracker.total,
            step="unpack"
        )

        # Decompress the gzipped tarball to the root of the temporary directory.
        await self.run_in_thread(
            virtool.utils.decompress_tgz,
            os.path.join(self.temp_path, "release.tar.gz"),
            self.temp_path
        )

    async def check_tree(self):
        # Start check tree step, reporting this to the DB.
        tracker = await self.get_tracker()
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.initial + tracker.total,
            step="verify"
        )

        # Check that the file structure matches our expectations.
        decompressed_path = os.path.join(self.temp_path, "virtool")

        good_tree = await self.run_in_thread(virtool.software.utils.check_software_files, decompressed_path)

        if not good_tree:
            await virtool.tasks.pg.update(self.pg, self.id, error="Invalid unpacked installation tree")

    async def copy_files(self):
        # Copy the update files to the install directory.
        tracker = await self.get_tracker()
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.initial + tracker.total,
            step="install"
        )

        await self.run_in_thread(
            virtool.software.utils.copy_software_files,
            os.path.join(self.temp_path, "virtool"),
            virtool.software.utils.INSTALL_PATH
        )

        await asyncio.sleep(1.5)

        self.app["events"]["restart"].set()


async def fetch_and_update_releases(app, ignore_errors=False):
    """
    Get a list of releases, from the Virtool website, published since the current server version.

    :param app: the application object

    :param ignore_errors: ignore errors during request to virtool.ca
    :type ignore_errors: bool

    :return: a list of releases
    :rtype: Coroutine[list]

    """
    db = app["db"]
    version = app["version"]
    session = app["client"]
    settings = app["settings"]

    if app is None or version == "Unknown":
        return list()

    try:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, VIRTOOL_RELEASES_URL) as resp:
            data = await resp.text()
            data = json.loads(data)

        logger.debug("Retrieved software releases from www.virtool.ca")
    except aiohttp.ClientConnectorError:
        # Return any existing release list or `None`.
        logger.debug("Could not retrieve software releases")

        await db.status.update_one({"_id": "software"}, {
            "$set": {
                "errors": ["Could not retrieve software releases"]
            }
        })

        if not ignore_errors:
            raise

        return await virtool.db.utils.get_one_field(db.status, "releases", "software")

    releases = virtool.software.utils.filter_releases_by_channel(data["virtool"], settings["software_channel"])
    releases = virtool.software.utils.filter_releases_by_newer(releases, version)

    await db.status.update_one({"_id": "software"}, {
        "$set": {
            "errors": [],
            "mongo_version": await virtool.db.utils.determine_mongo_version(db),
            "releases": releases
        }
    })

    return releases


async def refresh(app):
    """
    To be run in job scheduler. Automatically checks for software releases every 12 hours.

    :param app: the application object

    """
    try:
        logging.debug("Started software refresher")

        while True:
            await fetch_and_update_releases(app, ignore_errors=True)
            await asyncio.sleep(43200)
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped software refresher")


async def update_software_task(db, progress, step=None):
    """
    Update the task field in the software update document. Used to keep track of the current progress of the update
    task.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param progress: the numeric progress number for the step
    :type progress: Union(int, float)

    :param step: the name of the step in progress
    :type step: str

    """
    return await update_status_task(db, "software", progress, step)


async def update_status_task(db, _id, progress, step=None, error=None):
    """
    Update the task field in a status document. These fields are used to track long-running asynchronous tasks
    such as software updates or data imports.

    More specific update function can be built around this utility.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param _id: the database _id for the status document
    :type _id: str

    :param progress: the numeric progress number for the step
    :type progress: Union(int, float)

    :param step: the name of the step in progress
    :type step: Coroutine[str]

    :param error: an error that stopped the task
    :type error: str

    :return: processed status document
    :rtype:

    """
    set_dict = {
        "task.progress": progress
    }

    if step:
        set_dict["task.step"] = step

    if error:
        set_dict["task.error"] = error

    document = await db.status.find_one_and_update({"_id": _id}, {
        "$set": set_dict
    })

    return virtool.utils.base_processor(document)
