import asyncio
import json
import logging
import os

import aiohttp

import virtool.processes.db
import virtool.db.utils
import virtool.http.proxy
import virtool.http.utils
import virtool.processes.process
import virtool.software.utils
import virtool.software.utils
import virtool.utils

logger = logging.getLogger(__name__)

VIRTOOL_RELEASES_URL = "https://www.virtool.ca/releases4"


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


async def install(app, release, process_id):
    """
    Installs the update described by the passed release document.

    """
    db = app["db"]

    with virtool.utils.get_temp_dir() as tempdir:
        # Download the release from GitHub and write it to a temporary directory.
        compressed_path = os.path.join(str(tempdir), "release.tar.gz")

        progress_tracker = virtool.processes.process.ProgressTracker(
            db,
            process_id,
            release["size"],
            factor=0.5,
            increment=0.03,
            initial=0
        )

        try:
            await virtool.http.utils.download_file(
                app,
                release["download_url"],
                compressed_path,
                progress_handler=progress_tracker.add
            )
        except FileNotFoundError:
            await virtool.processes.db.update(db, process_id, errors=[
                "Could not write to release download location"
            ])

        # Start decompression step, reporting this to the DB.
        await virtool.processes.db.update(
            db,
            process_id,
            progress=0.5,
            step="unpack"
        )

        # Decompress the gzipped tarball to the root of the temporary directory.
        await app["run_in_thread"](virtool.utils.decompress_tgz, compressed_path, str(tempdir))

        # Start check tree step, reporting this to the DB.
        await virtool.processes.db.update(
            db,
            process_id,
            progress=0.7,
            step="verify"
        )

        # Check that the file structure matches our expectations.
        decompressed_path = os.path.join(str(tempdir), "virtool")

        good_tree = await app["run_in_thread"](virtool.software.utils.check_software_files, decompressed_path)

        if not good_tree:
            await virtool.processes.db.update(db, process_id, errors=[
                "Invalid unpacked installation tree"
            ])

        # Copy the update files to the install directory.
        await virtool.processes.db.update(
            db,
            process_id,
            progress=0.9,
            step="install"
        )

        await app["run_in_thread"](
            virtool.software.utils.copy_software_files,
            decompressed_path,
            virtool.software.utils.INSTALL_PATH
        )

        await virtool.processes.db.update(
            db,
            process_id,
            progress=1
        )

        await asyncio.sleep(1.5)

        app["events"]["restart"].set()


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

    logging.debug("Started HMM refresher")


async def update_software_process(db, progress, step=None):
    """
    Update the process field in the software update document. Used to keep track of the current progress of the update
    process.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param progress: the numeric progress number for the step
    :type progress: Union(int, float)

    :param step: the name of the step in progress
    :type step: str

    """
    return await update_status_process(db, "software", progress, step)


async def update_status_process(db, _id, progress, step=None, error=None):
    """
    Update the process field in a status document. These fields are used to track long-running asynchronous processes
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

    :param error: an error that stopped the process
    :type error: str

    :return: processed status document
    :rtype: Coroutine[dict]

    """
    set_dict = {
        "process.progress": progress
    }

    if step:
        set_dict["process.step"] = step

    if error:
        set_dict["process.error"] = error

    document = await db.status.find_one_and_update({"_id": _id}, {
        "$set": set_dict
    })

    return virtool.utils.base_processor(document)
