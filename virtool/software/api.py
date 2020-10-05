import aiohttp
import aiojobs.aiohttp

import virtool.db.utils
import virtool.github
import virtool.hmm.db
import virtool.http.routes
import virtool.tasks.db
import virtool.software.db
import virtool.software.utils
import virtool.utils
from virtool.api.response import bad_gateway, json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/software")
async def get(req):
    db = req.app["db"]

    await virtool.software.db.fetch_and_update_releases(req.app, ignore_errors=True)

    document = await db.status.find_one("software")

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/software/releases")
async def list_releases(req):
    try:
        releases = await virtool.software.db.fetch_and_update_releases(req.app)
    except aiohttp.ClientConnectorError:
        return bad_gateway("Could not connection to www.virtool.ca")

    return json_response(releases)


@routes.get("/api/software/updates")
async def list_updates(req):
    updates = virtool.db.utils.get_one_field(req.app["db"].status, "updates", "software")
    return json_response(updates)


@routes.post("/api/software/updates", admin=True)
async def install(req):
    db = req.app["db"]

    releases = await virtool.db.utils.get_one_field(db.status, "releases", "software")

    try:
        latest_release = releases[0]
    except IndexError:
        return not_found("Could not find latest uninstalled release")

    task = await virtool.tasks.db.register(
        db,
        "update_software",
        context={
            "file_size": latest_release["size"]
        }
    )

    await db.status.update_one({"_id": "software"}, {
        "$set": {
            "task": task,
            "updating": True
        }
    })

    update = virtool.github.create_update_subdocument(
        latest_release,
        False,
        req["client"].user_id,
        virtool.utils.timestamp()
    )

    await aiojobs.aiohttp.spawn(req, virtool.software.db.install(
        req.app,
        latest_release,
        task["id"]
    ))

    return json_response(update)
