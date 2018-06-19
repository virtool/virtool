import asyncio

import virtool.db.hmm
import virtool.db.processes
import virtool.db.status
import virtool.http.routes
import virtool.status
import virtool.utils
from virtool.api.utils import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/software")
async def get_software(req):
    db = req.app["db"]
    settings = req.app["settings"]
    session = req.app["client"]

    document = await virtool.db.status.fetch_and_update_software_releases(
        db,
        settings,
        session,
        req.app["version"]
    )

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/software", admin=True)
async def upgrade_software(req):
    db = req.app["db"]
    settings = req.app["settings"]
    session = req.app["client"]

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
        document = await virtool.db.status.fetch_and_update_software_releases(
            db,
            session,
            settings,
            req.app["version"]
        )

    releases = document["releases"]

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
    })

    download_url = latest_release["download_url"]

    await asyncio.ensure_future(virtool.status.install(
        req.app,
        db,
        req.app["settings"],
        req.app.loop,
        download_url,
        latest_release["size"]
    ), loop=req.app.loop)

    return json_response(document)
