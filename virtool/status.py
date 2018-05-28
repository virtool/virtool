import asyncio
import logging
import os
import shutil
import sys

import virtool.app
import virtool.db.processes
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.http.proxy
import virtool.http.utils
import virtool.processes
import virtool.utils
from virtool.utils import get_temp_dir

logger = logging.getLogger(__name__)

INSTALL_PATH = sys.path[0]

SOFTWARE_REPO = "virtool/virtool"

RELEASE_KEYS = [
    "name",
    "body",
    "prerelease",
    "published_at",
    "html_url"
]


def check_software_files(path):
    if not {"client", "run", "VERSION"}.issubset(set(os.listdir(path))):
        return False

    client_content = os.listdir(os.path.join(path, "client"))

    if "favicon.ico" not in client_content or "index.html" not in client_content:
        return False

    if not any(["app." in filename and ".js" in filename for filename in client_content]):
        return False

    return True


def copy_software_files(src, dest):
    for dirname in ["templates", "lib", "client", "assets"]:
        shutil.rmtree(os.path.join(dest, dirname), ignore_errors=True)

    for name in os.listdir(src):
        src_path = os.path.join(src, name)
        dest_path = os.path.join(dest, name)

        if os.path.isfile(dest_path):
            os.remove(dest_path)

        if os.path.isfile(src_path):
            shutil.copy(src_path, dest_path)

        if os.path.isdir(dest_path):
            shutil.rmtree(dest_path)

        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path)


async def install_software(app, download_url, process_id, size):
    """
    Installs the update described by the passed release document.

    """
    db = app["db"]

    with get_temp_dir() as tempdir:
        # Download the release from GitHub and write it to a temporary directory.
        compressed_path = os.path.join(str(tempdir), "release.tar.gz")

        progress_handler = virtool.processes.ProgressTracker(
            db,
            process_id,
            size,
            factor=0.5,
            initial=0
        )

        try:
            await virtool.http.utils.download_file(
                app,
                download_url,
                compressed_path,
                progress_handler=progress_handler.add
            )
        except FileNotFoundError:
            await virtool.db.processes.update(db, process_id, errors=[
                "Could not write to release download location"
            ])

        # Start decompression step, reporting this to the DB.
        await virtool.db.processes.update(db, process_id, step="unpack")

        # Decompress the gzipped tarball to the root of the temporary directory.
        await app["run_in_thread"](virtool.utils.decompress_tgz, compressed_path, str(tempdir))

        # Start check tree step, reporting this to the DB.
        await virtool.db.processes.update(db, process_id, step="verify")

        # Check that the file structure matches our expectations.
        decompressed_path = os.path.join(str(tempdir), "virtool")

        good_tree = await app["run_in_thread"](check_software_files, decompressed_path)

        if not good_tree:
            await virtool.db.processes.update(db, process_id, errors=[
                "Invalid unpacked installation tree"
            ])

        # Copy the update files to the install directory.
        await virtool.db.processes.update(db, process_id, step="install")

        await app["run_in_thread"](copy_software_files, decompressed_path, INSTALL_PATH)

        await virtool.db.processes.update(db, process_id, progress=1)

        await asyncio.sleep(1.5, loop=app.loop)

        await virtool.utils.reload(app)


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
