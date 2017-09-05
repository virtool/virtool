import os
import sys
import shutil
import aiohttp
import tarfile
import logging
import tempfile
import urllib.request

import virtool.utils

logger = logging.getLogger(__name__)

INSTALL_PATH = os.path.dirname(os.path.realpath(sys.argv[0]))

RELEASE_KEYS = [
    "name",
    "body",
    "prerelease",
    "published_at",
    "html_url"
]


async def get_releases(repo, server_version):
    headers = {
        "user-agent": "virtool/{}".format(server_version)
    }

    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.github.com/repos/{}/releases".format(repo), headers=headers) as resp:
            data = await resp.json()

    releases = []

    # Reformat the release dicts to make them more palatable. If the response code was not 200, the releases list
    # will be empty. This is interpreted by the web client as an error.
    if resp.status == 200:
        releases = [format_software_release(release) for release in data if not release["prerelease"]]

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


async def upgrade_to_latest(db, job_manager):
    """
    Starts the update install process. Blocks all waiting jobs from starting. Then, removes any existing
    "software_update"-type document from the database and inserts a new one.

    Finally the install process is started by calling :meth:`.install_update` using :meth:`spawn_callback`. The
    latest release document is passed to :meth:`.install_update`.

    :param transaction: a :class:`~.Transaction` object containing the name of the release to install.
    :type transaction: :class:`~.Transaction`

    :return: a tuple in the form (``True``, ``None``)
    :rtype: tuple

    """
    await job_manager.close()

    # Update any pre-existing software_update document.
    await db.status.update_one({"_id": "software_update"}, {
        "$set": {
            "process": None
        }
    })

    # Insert the new software update document, which contains information about the install process.
    await self.insert_one({
        "_id": "software_install",
        "name": transaction.data["name"],
        "type": "software_install",
        "size": release["size"],
        "display_notification": transaction.data["displayNotification"],
        "delete_temporary": transaction.data["deleteTemporary"],
        "forcefully_cancel": transaction.data["forcefullyCancel"],
        "shutdown": transaction.data["shutdown"],
        "step": "block_jobs",
        "progress": 0,
        "good_tree": True,
        "complete": False
    })

    # Start the install process outside of the exposed method so the transaction can be returned. This is done by
    # calling :meth:`.install_update` with :meth:`spawn_callback` and passing the latest release to it.
    tornado.ioloop.IOLoop.current().spawn_callback(self.install_update, release)

    return True, None


def install_update(self, release):
    """
    Installs the update described by the passed release document.

    :param release:
    :return:

    """
    with tempfile.TemporaryDirectory() as tempdir:
        # Download the release from GitHub and write it to a temporary directory.
        yield self.update_software_step(0, "download")
        compressed_path = os.path.join(str(tempdir), "release.tar.gz")
        yield download_release(release["download_url"], release["size"], compressed_path, self.update_software_step)

        # Decompress the gzipped tarball to the root of the temporary directory.
        yield self.update_software_step(0, "decompress")
        yield decompress_file(compressed_path, str(tempdir))
        decompressed_path = os.path.join(str(tempdir), "virtool")

        # Check that the file structure matches our expectations.
        yield self.update_software_step(0, "check_tree")
        good_tree = yield check_software_tree(decompressed_path)

        yield self.update_one({"_id": "software_install"}, {
            "$set": {
                "good_tree": good_tree
            }
        })

        # Copy the update files to the install directory.
        yield self.update_software_step(0, "copy_files")
        yield copy_software_files(decompressed_path, INSTALL_PATH)

        yield self.delete_one(["software_install"])

        yield tornado.gen.sleep(1.5)

        yield self.reload()


def download_release(url, size, target_path, progress_handler):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``. Release files are downloaded in
    chunks. The ``progress_handler`` function is called with total number of bytes downloaded every time a chunk is
    read.

    :param url: the download URL for the release
    :type url str

    :param size: the size in bytes of the file to be downloaded.
    :type size: int

    :param target_path: the path to write the downloaded file to.
    :type target_path: str

    :param progress_handler: a function to call with the number of download bytes at each chunk read.
    :type progress_handler: func

    """
    url_file = yield get_url_file(url)

    counter = 0
    last_reported = 0

    with open(target_path, "wb") as target:
        while True:
            data = yield read_url_file(url_file)
            if not data:
                break

            target.write(data)

            if progress_handler:
                counter += len(data)
                progress = round(counter / size, 2)
                if progress - last_reported >= 0.01:
                    last_reported = progress
                    yield progress_handler(progress)


def get_url_file(url):
    """
    A coroutine that just calls :meth:`urllib.request.urlopen` in a separate thread for the given ``url`` and returns
    the result.

    :param url: the URL to open the URL file for.
    :type url: str

    :return: a URL file for the ``url``

    """
    return urllib.request.urlopen(url)


def read_url_file(url_file):
    """
    Reads and returns a 4 KB chunk from the passed ``url_file``. Calls in a separate thread.
    :param url_file:
    :return:
    """
    return url_file.read(4096)


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


def check_software_tree(path):
    if set(os.listdir(path)) != {"client", "install.sh", "run", "VERSION"}:
        return False

    client_content = os.listdir(os.path.join(path, "client"))

    if "favicon.ico" not in client_content or "index.html" not in client_content:
        return False

    if not any(["app." in filename and ".js" in filename for filename in client_content]):
        return False

    return True


def copy_software_files(src, dest):
    # Remove the client dir and replace it with the new one.
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
