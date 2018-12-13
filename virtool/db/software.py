import asyncio
import json
import logging
import os

import aiohttp
import semver

import virtool.db
import virtool.db.processes
import virtool.db.utils
import virtool.http.proxy
import virtool.http.utils
import virtool.processes
import virtool.software
import virtool.utils

logger = logging.getLogger(__name__)

VIRTOOL_RELEASES_URL = "https://www.virtool.ca/releases3"


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

    if app is None:
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

    data = data["virtool"]

    channel = settings["software_channel"]

    # Reformat the release dicts to make them more palatable. If the response code was not 200, the releases list
    # will be empty. This is interpreted by the web client as an error.
    if channel == "stable":
        data = [r for r in data if "alpha" not in r["name"] and "beta" not in r["name"]]

    elif channel == "beta":
        data = [r for r in data if "alpha" not in r["name"]]

    releases = list()

    for release in data:
        if semver.compare(release["name"].replace("v", ""), version.replace("v", "")) < 1:
            break

        releases.append(release)

    await db.status.update_one({"_id": "software"}, {
        "$set": {
            "errors": [],
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

        progress_tracker = virtool.processes.ProgressTracker(
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
            await virtool.db.processes.update(db, process_id, errors=[
                "Could not write to release download location"
            ])

        # Start decompression step, reporting this to the DB.
        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.5,
            step="unpack"
        )

        # Decompress the gzipped tarball to the root of the temporary directory.
        await app["run_in_thread"](virtool.utils.decompress_tgz, compressed_path, str(tempdir))

        # Start check tree step, reporting this to the DB.
        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.7,
            step="verify"
        )

        # Check that the file structure matches our expectations.
        decompressed_path = os.path.join(str(tempdir), "virtool")

        good_tree = await app["run_in_thread"](virtool.software.check_software_files, decompressed_path)

        if not good_tree:
            await virtool.db.processes.update(db, process_id, errors=[
                "Invalid unpacked installation tree"
            ])

        # Copy the update files to the install directory.
        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.9,
            step="install"
        )

        await app["run_in_thread"](
            virtool.software.copy_software_files,
            decompressed_path,
            virtool.software.INSTALL_PATH
        )

        await virtool.db.processes.update(
            db,
            process_id,
            progress=1
        )

        await asyncio.sleep(1.5, loop=app.loop)

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
            await asyncio.sleep(43200, loop=app.loop)
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
    return await virtool.utils.update_status_process(db, "software", progress, step)
