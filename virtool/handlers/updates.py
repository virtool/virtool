import pymongo

import virtool.app
import virtool.utils
import virtool.updates
from virtool.handlers.utils import json_response, not_found


async def get(req):
    db = req.app["db"]
    settings = req.app["settings"]

    channel = settings.get("software_channel")

    username, token = settings.get("github_username"), settings.get("github_token")

    releases = await virtool.updates.get_releases(db, channel, req.app["version"], username, token)

    document = await db.status.find_one_and_update({"_id": "software_update"}, {
        "$set": {
            "releases": releases,
            "current_version": req.app["version"]
        }
    })

    return json_response(virtool.utils.base_processor(document))


async def upgrade(req):

    db = req.app["db"]
    settings = req.app["settings"]
    dispatch = req.app["dispatcher"].dispatch

    await req.app["job_manager"].close()

    document = await db.status.find_one("software_update")

    if document is None:
        document = {
            "_id": "software_update",
            "process": None,
            "releases": None
        }

        await db.status.insert_one(document)

    if not document.get("releases", None):
        username, token = settings.get("github_username"), settings.get("github_token")

        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "releases": await virtool.updates.get_releases(db, req.app["version"], username, token)
            }
        }, return_document=pymongo.ReturnDocument)

        await dispatch("status", "update", virtool.utils.base_processor(document))

    releases = document.get("releases", list())

    try:
        latest_release = releases[0]
    except IndexError:
        return not_found("Could not find latest uninstalled release")

    document = await db.status.find_one_and_update({"_id": "software_update"}, {
        "$set": {
            "process": {
                "size": latest_release["size"],
                "step": "block_jobs",
                "progress": 0,
                "good_tree": True,
                "complete": False,
                "error": False
            }
        }
    }, return_document=pymongo.ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    download_url = latest_release["download_url"]

    req.app.loop.create_task(virtool.updates.install(
        db,
        dispatch,
        req.app.loop,
        download_url,
        latest_release["size"]
    ))

    return json_response(document)
