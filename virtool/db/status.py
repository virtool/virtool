import json

import aiohttp
import semver

import virtool.db.utils
import virtool.github
import virtool.http.proxy
import virtool.utils

VIRTOOL_RELEASES_URL = "https://www.virtool.ca/releases"


async def get_hmm_status(db):
    status = await db.status.find_one("hmm")

    status = virtool.utils.base_processor(status)

    status["updating"] = len(status["updates"]) > 1 and status["updates"][-1]["ready"]

    del status["updates"]

    return status


async def fetch_and_update_hmm_release(app):
    """
    Return the HMM install status document or create one if none exists.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    db = app["db"]
    settings = app["settings"]
    session = app["client"]

    etag = None

    document = await db.status.find_one("hmm", ["release", "updates"])

    existing = document.get("release", None)

    try:
        installed = document["updates"][-1]
    except (IndexError, KeyError):
        installed = None

    if existing:
        etag = existing.get("etag", None)

    release = await virtool.github.get_release(settings, session, "virtool/virtool-hmm", etag)

    if release:
        release = virtool.github.format_release(release)
    else:
        release = existing

    release["newer"] = bool(
        release is None or (
            installed and
            semver.compare(release["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
        )
    )

    await db.status.update_one({"_id": "hmm"}, {
        "$set": {
            "release": release
        }
    }, upsert=True)

    return release


async def fetch_and_update_software_releases(db, settings, session, server_version):
    """
    Get a list of releases, from the Virtool website, published since the current server version.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param session: the application HTTP session object
    :type session: :class:`aiohttp.ClientSession`

    :param server_version: the current server version
    :type server_version: str

    :return: a list of releases
    :rtype: Coroutine[list]

    """
    if server_version is None:
        return list()

    try:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, VIRTOOL_RELEASES_URL) as resp:
            data = await resp.text()
            data = json.loads(data)

    except aiohttp.ClientConnectionError:
        # Return any existing release list or `None`.
        return await virtool.db.utils.get_one_field(db.status, "releases", "software")

    data = data["software"]

    channel = settings["software_channel"]

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

    document = await db.status.find_one_and_update({"_id": "software"}, {
        "$set": {
            "releases": releases
        }
    }, upsert=True)

    return document
