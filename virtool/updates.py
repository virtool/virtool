import logging
import requests
from requests import auth

import virtool.gen
import virtool.database
import virtool.utils

logger = logging.getLogger(__name__)

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
    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("updates", dispatch, collections, settings, add_periodic_callback)

        self.sync_projector = None

    @virtool.gen.exposed_method(["modify_options"])
    def refresh_software_releases(self, transaction):
        """
        An exposed method for calling :meth:`.update_software_release`. Normally this is run

        :return: current index version.
        :rtype: int

        """
        yield self.update_software_releases()
        return True, None

    @virtool.gen.coroutine
    def update_software_releases(self):
        """
        Contact GitHub and get data describing the latest release of the Virtool software.

        """
        response = requests.get(
            "https://api.github.com/repos/{}/releases".format(self.settings.get("software_repo")),
            headers={"user-agent": "virtool/{}".format(self.settings.get("server_version"))}
        )

        releases = []

        if response.status_code == 200:
            releases = [format_software_release(release) for release in response.json()[0:5]]

        to_remove = yield self.find({"type": "software"}).distinct("_id")

        for release in releases:
            yield self.update({"_id": release["_id"]}, {
                "$set": release,
                "$inc": {"_version": 1}
            }, upsert=True, increment_version=False)

            try:
                to_remove.remove(release["_id"])
            except ValueError:
                pass

        if to_remove:
            yield self.remove(to_remove)


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
