import os
import sys
import shutil
import tarfile
import logging
import requests
import tempfile
import urllib.request
import tornado.ioloop
import tornado.gen

import virtool.gen
import virtool.database
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


class Collection(virtool.database.Collection):

    """
    An :class:`.virtool.database.Collection` interface for the *updates* MongoDB collection.

    """
    def __init__(self, dispatch, collections, settings, add_periodic_callback, reload):
        super().__init__("updates", dispatch, collections, settings, add_periodic_callback)

        self.reload = reload
        self.sync_projector = None

    @virtool.gen.exposed_method(["modify_options"])
    def refresh_software_releases(self, transaction):
        """
        An exposed method for allowing clients to call :meth:`.update_software_release`.

        :return: always (``True``, ``None``)
        :rtype: tuple

        """
        yield self.update_software_releases()
        return True, None

    @virtool.gen.coroutine
    def update_software_releases(self):
        """
        Use the GitHub API to get data describing the latest releases of the Virtool software. The five most recent
        releases are upserted in the ``updates`` MongoDB collection. Any older releases are removed from the database.

        """
        response = requests.get(
            "https://api.github.com/repos/{}/releases".format(self.settings.get("software_repo")),
            headers={"user-agent": "virtool/{}".format(self.settings.get("server_version"))}
        )

        # This list will contain dicts describing the releases retrieved from GitHub.
        releases = []

        # Reformat the release dicts to make them more palatable. If the response code was not 200, the releases list
        # will be empty. This is interpreted by the web client as an error.
        if response.status_code == 200:
            releases = [format_software_release(release) for release in response.json() if not release["prerelease"]]
            releases = releases[0:5]

        # A list of ids of documents that should be removed from the updates collection. Initially all document ids in
        # the collection.
        to_remove = yield self.find({"type": "software"}).distinct("_id")

        # Upsert the releases. Remove upserted document ids from the ``to_remove`` list.
        for release in releases:
            yield self.update({"_id": release["_id"]}, {
                "$set": release,
                "$inc": {"_version": 1}
            }, upsert=True, increment_version=False)

            try:
                to_remove.remove(release["_id"])
            except ValueError:
                pass

        # Remove any documents whose ids are still in the ``to_remove`` list.
        if to_remove:
            yield self.remove(to_remove)

    @virtool.gen.exposed_method(["modify_options"])
    def upgrade_to_latest(self, transaction):
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
        # Block any more jobs from starting.
        self.collections["jobs"].blocked = True

        # Update any pre-existing software_update document.
        yield self.remove(["software_install"])

        # Get the latest release document from the updates collection.
        release = yield self.find_one({"name": transaction.data["name"]})

        # Insert the new software update document, which contains information about the install process.
        yield self.insert({
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

    @virtool.gen.coroutine
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

            yield self.update({"_id": "software_install"}, {
                "$set": {
                    "good_tree": good_tree
                }
            })

            # Copy the update files to the install directory.
            yield self.update_software_step(0, "copy_files")
            yield copy_software_files(decompressed_path, INSTALL_PATH)

            yield self.remove(["software_install"])

            yield tornado.gen.sleep(1.5)

            yield self.reload()

    @virtool.gen.coroutine
    def update_software_step(self, progress, step=None):
        set_dict = dict(progress=progress)

        if step:
            set_dict["step"] = step

        yield self.update({"_id": "software_install"}, {
            "$set": set_dict
        })


@virtool.gen.coroutine
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


@virtool.gen.synchronous
def get_url_file(url):
    """
    A coroutine that just calls :meth:`urllib.request.urlopen` in a separate thread for the given ``url`` and returns
    the result.

    :param url: the URL to open the URL file for.
    :type url: str

    :return: a URL file for the ``url``

    """
    return urllib.request.urlopen(url)


@virtool.gen.synchronous
def read_url_file(url_file):
    """
    Reads and returns a 4 KB chunk from the passed ``url_file``. Calls in a separate thread.
    :param url_file:
    :return:
    """
    return url_file.read(4096)


@virtool.gen.synchronous
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


@virtool.gen.synchronous
def check_software_tree(path):
    if set(os.listdir(path)) != {"client", "install.sh", "run", "VERSION"}:
        return False

    client_content = os.listdir(os.path.join(path, "client"))

    if "favicon.ico" not in client_content or "index.html" not in client_content:
        return False

    if not any(["app." in filename and ".js" in filename for filename in client_content]):
        return False

    return True


@virtool.gen.synchronous
def copy_software_files(src, dest):
    # Remove the client and doc dirs and replace them with the new ones.
    for dirname in ["client", "doc"]:
        try:
            shutil.rmtree(os.path.join(dest, dirname))
        except FileNotFoundError:
            pass

        shutil.copytree(os.path.join(src, dirname), os.path.join(dest, dirname))

    # Remove the old files and copy in new ones.
    for filename in ["run", "VERSION"]:
        try:
            os.remove(filename)
        except FileNotFoundError:
            pass

        shutil.copy(os.path.join(src, filename), dest)


def format_software_release(release):
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

    formatted.update({
        "_id": "software-" + release["name"],
        "type": "software",
        "asset_error": asset_error
    })

    return formatted
