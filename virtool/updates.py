import aiohttp
import asyncio
import json
import logging
import pymongo
import os
import semver
import sys
import shutil
import tempfile

import virtool.app
import virtool.errors
import virtool.github
import virtool.utils

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


async def get_releases(db, channel, server_version):
    """
    Get a list of releases, from the Virtool Github repository, published since the current server version.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param channel: the software channel to use
    :type channel: str

    :return: a list of Github releases
    :rtype: Coroutine[list]

    """
    url = "https://www.virtool.ca/releases"

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.text()
            data = json.loads(data)

    data = data["software"]

    # Reformat the release dicts to make them more palatable. If the response code was not 200, the releases list
    # will be empty. This is interpreted by the web client as an error.
    if channel == "stable":
        data = [r for r in data if "alpha" not in r["name"] and "beta" not in r["name"]]

    elif channel == "beta":
        data = [r for r in data if "alpha" not in r["name"]]

    releases = list()

    for release in data:
        if semver.compare(release["name"].replace("v", ""), server_version.replace("v", "")) == 1:
            releases.append(release)

    await db.status.update_one({"_id": "software_update"}, {
        "$set": {
            "releases": releases
        }
    }, upsert=True)

    return releases


def format_software_release(release):
    """
    Format a raw GitHub release object (dict) to something that can be sent to clients.

    :param release: a raw GitHub release object
    :type release: dict

    :return: a formatted release
    :rtype: dict

    """
    formatted = {key: release[key] for key in RELEASE_KEYS}

    asset_error = False

    try:
        asset = release["assets"][0]

        formatted.update({
            "filename": asset["name"],
            "content_type": asset["content_type"],
            "size": asset["size"],
            "download_url": asset["browser_download_url"]
        })
    except (KeyError, IndexError):
        asset_error = True

    formatted["asset_error"] = asset_error

    return formatted


async def install(app, db, dispatch, loop, download_url, size):
    """
    Installs the update described by the passed release document.

    :param db:
    :return:

    """
    with get_temp_dir() as tempdir:
        # Start download release step, reporting this to the DB.
        await update_software_process(db, dispatch, 0, "download")

        # Download the release from GitHub and write it to a temporary directory.
        compressed_path = os.path.join(str(tempdir), "release.tar.gz")

        async def handler(progress):
            await update_software_process(db, dispatch, progress)

        try:
            await virtool.github.download_asset(download_url, size, compressed_path, progress_handler=handler)
        except virtool.errors.GitHubError:
            document = await db.status.find_one_and_update({"_id": "software_update"}, {
                "$set": {
                    "process.error": "Could not find GitHub repository"
                }
            }, return_document=pymongo.ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            return
        except FileNotFoundError:
            document = await db.status.find_one_and_update({"_id": "software_update"}, {
                "$set": {
                    "process.error": "Could not write to release download location"
                }
            }, return_document=pymongo.ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            return

        # Start decompression step, reporting this to the DB.
        await update_software_process(db, dispatch, 0, "decompress")

        # Decompress the gzipped tarball to the root of the temporary directory.
        await loop.run_in_executor(None, virtool.github.decompress_asset_file, compressed_path, str(tempdir))

        # Start check tree step, reporting this to the DB.
        await update_software_process(db, dispatch, 0, "check_tree")

        # Check that the file structure matches our expectations.
        decompressed_path = os.path.join(str(tempdir), "virtool")

        good_tree = await loop.run_in_executor(None, check_tree, decompressed_path)

        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "process.good_tree": good_tree
            }
        }, return_document=pymongo.ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

        # Copy the update files to the install directory.
        await update_software_process(db, dispatch, 0, "copy_files")

        print(decompressed_path, INSTALL_PATH)

        await loop.run_in_executor(None, copy_software_files, decompressed_path, INSTALL_PATH)

        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "process.complete": True
            }
        }, return_document=pymongo.ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

        await asyncio.sleep(1.5, loop=loop)

        await virtool.utils.reload(app)


def get_temp_dir():
    return tempfile.TemporaryDirectory()


async def update_software_process(db, dispatch, progress, step=None):
    """
    Update the process field in the software update document. Used to keep track of the current progress of the update
    process.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: a reference to the dispatcher's dispatch method
    :type dispatch: func

    :param progress: the numeric progress number for the step
    :type progress: Union(int, float)

    :param step: the name of the step in progress
    :type step: str

    """
    return await virtool.utils.update_status_process(db, dispatch, "software_update", progress, step)


def check_tree(path):
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
