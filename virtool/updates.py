import os
import sys
import shutil
import tarfile
import pymongo
import asyncio
import logging
import aiohttp
import aiofiles
import tempfile

import virtool.app
import virtool.utils
import virtool.errors

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


async def get_releases(db, channel, server_version, username=None, token=None):
    """
    Get a list of releases, from the Virtool Github repository, published since the current server version.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param channel: the software channel to use
    :type channel: str

    :param server_version: the current server version string
    :type server_version: str

    :param username: a Github username
    :type username: str

    :param token: a Github personal access token
    :type token: str

    :return: a list of Github releases
    :rtype: Coroutine[list]

    """
    headers = {
        "user-agent": "virtool/{}".format(server_version),
        "Accept": "application/vnd.github.v3+json"
    }

    auth = None

    if token is not None:
        auth = aiohttp.BasicAuth(login=username, password=token)

    url = "https://api.github.com/repos/{}/releases".format(SOFTWARE_REPO)

    async with aiohttp.ClientSession(auth=auth) as session:
        async with session.get(url, headers=headers) as resp:
            data = await resp.json()

    if resp.status != 200:
        raise virtool.errors.GitHubError("Could not retrieve GitHub data: {}".format(resp.status))

    # Reformat the release dicts to make them more palatable. If the response code was not 200, the releases list
    # will be empty. This is interpreted by the web client as an error.
    if channel == "stable":
        data = [release for release in data if "alpha" not in release["name"] and "beta" not in release["name"]]

    elif channel == "beta":
        data = [release for release in data if "alpha" not in release["name"]]

    releases = [format_software_release(release) for release in data if release["assets"]]

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


async def install(db, dispatch, loop, download_url, size):
    """
    Installs the update described by the passed release document.

    :param db:
    :return:

    """
    with get_temp_dir() as tempdir:

        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "current_version": await virtool.app.find_server_version(loop)
            }
        }, return_document=pymongo.ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

        # Start download release step, reporting this to the DB.
        await update_software_process(db, dispatch, 0, "download")

        # Download the release from GitHub and write it to a temporary directory.
        compressed_path = os.path.join(str(tempdir), "release.tar.gz")

        try:
            await download_release(db, dispatch, download_url, size, compressed_path)
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
        await loop.run_in_executor(None, decompress_file, compressed_path, str(tempdir))

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

        await loop.run_in_executor(None, copy_software_files, decompressed_path, INSTALL_PATH)

        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "process": None
            }
        }, return_document=pymongo.ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

        await asyncio.sleep(1.5, loop=loop)

        await virtool.utils.reload()


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
    set_dict = {
        "process.progress": progress
    }

    if step:
        set_dict["process.step"] = step

    document = await db.status.find_one_and_update({"_id": "software_update"}, {
        "$set": set_dict
    }, return_document=pymongo.ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))


async def download_release(db, dispatch, url, size, target_path):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: a reference to the dispatcher's dispatch method
    :type dispatch: func

    :param url: the download URL for the release
    :type url str

    :param size: the size in bytes of the file to be downloaded.
    :type size: int

    :param target_path: the path to write the downloaded file to.
    :type target_path: str

    """
    counter = 0
    last_reported = 0

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:

            if resp.status != 200:
                raise virtool.errors.GitHubError("Could not download release")

            async with aiofiles.open(target_path, "wb") as handle:
                while True:
                    chunk = await resp.content.read(4096)
                    if not chunk:
                        break

                    await handle.write(chunk)

                    counter += len(chunk)
                    progress = round(counter / size, 2)
                    if progress - last_reported >= 0.01:
                        last_reported = progress
                        await update_software_process(db, dispatch, progress)


def decompress_file(path, target):
    """
    Decompress the tar.gz file at ``path`` to the directory ``target``.

    :param path: the path to the tar.gz file.
    :type path: str

    :param target: the path to directory into which to decompress the tar.gz file.
    :type target: str

    """
    with tarfile.open(path, "r:gz") as tar:
        tar.extractall(target)


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
    try:
        shutil.rmtree(os.path.join(dest, "client"))
    except FileNotFoundError:
        pass

    shutil.copytree(os.path.join(src, "client"), os.path.join(dest, "client"))

    # Remove the old files and copy in new ones.
    for filename in ["run", "VERSION"]:
        try:
            os.remove(filename)
        except FileNotFoundError:
            pass

        shutil.copy(os.path.join(src, filename), dest)
