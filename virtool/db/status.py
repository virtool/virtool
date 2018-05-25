import json

import aiohttp
import semver

import virtool.db.utils
import virtool.github
import virtool.http.proxy
import virtool.utils

VIRTOOL_RELEASES_URL = "https://www.virtool.ca/releases"


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

    existing = await virtool.db.utils.get_one_field(db.status, "latest_release", "hmm")

    if existing:
        etag = existing.get("etag", None)

    release = await virtool.github.get_latest_release(settings, session, "virtool/virtool-hmm", etag)

    if release:
        return await db.status.find_one_and_update({"_id": "hmm"}, {
            "$set": {
                "latest_release": virtool.github.format_release(release)
            }
        }, upsert=True)

    return await db.status.find_one("hmm")


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
