import asyncio
import pymongo

import virtool.app
import virtool.utils
import virtool.updates
from virtool.handlers.utils import json_response, not_found, protected


async def get(req):
    db = req.app["db"]
    settings = req.app["settings"]

    channel = settings.get("software_channel")

    releases = await virtool.updates.get_releases(db, req.app["settings"], channel, req.app["version"])

    document = await db.status.find_one_and_update({"_id": "software_update"}, {
        "$set": {
            "releases": releases,
            "current_version": req.app["version"]
        }
    })

    return json_response(virtool.utils.base_processor(document))


@protected("modify_settings")
async def upgrade(req):

    db = req.app["db"]
    dispatch = req.app["dispatcher"].dispatch

    channel = req.app["settings"].get("software_channel")

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
        document = await db.status.find_one_and_update({"_id": "software_update"}, {
            "$set": {
                "current_version": req.app["version"],
                "releases": await virtool.updates.get_releases(db, req.app["settings"], channel, req.app["version"])
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

    await asyncio.ensure_future(virtool.updates.install(
        req.app,
        db,
        req.app["settings"],
        dispatch,
        req.app.loop,
        download_url,
        latest_release["size"]
    ), loop=req.app.loop)

    return json_response(document)
