import asyncio

import pymongo

import virtool.app
import virtool.http.routes
import virtool.updates
import virtool.utils
from virtool.api.utils import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/updates/software")
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
    }, return_document=pymongo.ReturnDocument.AFTER)

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/updates/software", admin=True)
async def upgrade(req):
    db = req.app["db"]

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

    download_url = latest_release["download_url"]

    await asyncio.ensure_future(virtool.updates.install(
        req.app,
        db,
        req.app["settings"],
        req.app.loop,
        download_url,
        latest_release["size"]
    ), loop=req.app.loop)

    return json_response(document)
