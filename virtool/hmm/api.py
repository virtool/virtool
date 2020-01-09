import os

import aiohttp
import aiojobs.aiohttp

import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.hmm.db
import virtool.http.routes
import virtool.processes.db
import virtool.utils
from virtool.api import bad_gateway, bad_request, compose_regex_query, conflict, json_response, no_content, \
    not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/hmms")
async def find(req):
    """
    Find HMM annotation documents.

    """
    db = req.app["db"]

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["names"]))

    data = await paginate(
        db.hmm,
        db_query,
        req.query,
        sort="cluster",
        projection=virtool.hmm.db.PROJECTION,
        base_query={"hidden": False}
    )

    data["status"] = await virtool.hmm.db.get_status(db)

    return json_response(data)


@routes.get("/api/hmms/status")
async def get_status(req):
    db = req.app["db"]
    status = await virtool.hmm.db.get_status(db)
    return json_response(status)


@routes.get("/api/hmms/status/release")
async def get_release(req):
    try:
        release = await virtool.hmm.db.fetch_and_update_release(req.app)
    except virtool.errors.GitHubError as err:
        if "404" in str(err):
            return bad_gateway("GitHub repository does not exist")

        raise

    except aiohttp.ClientConnectorError:
        return bad_gateway("Could not reach GitHub")

    if release is None:
        return not_found("Release not found")

    return json_response(release)


@routes.get("/api/hmms/status/updates")
async def list_updates(req):
    """
    List all updates applied to the HMM collection.

    """
    db = req.app["db"]

    updates = await virtool.db.utils.get_one_field(db.status, "updates", "hmm") or list()
    updates.reverse()

    return json_response(updates)


@routes.post("/api/hmms/status/updates", permission="modify_hmm")
async def install(req):
    """
    Install the latest official HMM database from GitHub.

    """
    db = req.app["db"]

    user_id = req["client"].user_id

    if await db.status.count({"_id": "hmm", "updates.ready": False}):
        return conflict("Install already in progress")

    process = await virtool.processes.db.register(
        db,
        "install_hmms"
    )

    document = await db.status.find_one_and_update({"_id": "hmm"}, {
        "$set": {
            "process": {
                "id": process["id"]
            }
        }
    })

    release = document.get("release")

    if release is None:
        return bad_request("Target release does not exist")

    update = virtool.github.create_update_subdocument(release, False, user_id)

    await db.status.update_one({"_id": "hmm"}, {
        "$push": {
            "updates": update
        }
    })

    await aiojobs.aiohttp.spawn(req, virtool.hmm.db.install(
        req.app,
        process["id"],
        release,
        user_id
    ))

    return json_response(update)


@routes.get("/api/hmms/{hmm_id}")
async def get(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document is None:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/hmms", permission="modify_hmm")
async def purge(req):
    """
    Delete all unreferenced HMMs and hide the rest.

    """
    db = req.app["db"]

    await virtool.hmm.db.purge(db, req.app["settings"])

    hmm_path = os.path.join(req.app["settings"]["data_path"], "hmm/profiles.hmm")

    try:
        await req.app["run_in_thread"](virtool.utils.rm, hmm_path)
    except FileNotFoundError:
        pass

    await db.status.find_one_and_update({"_id": "hmm"}, {
        "$set": {
            "installed": None,
            "process": None,
            "updates": list()
        }
    })

    await virtool.hmm.db.fetch_and_update_release(req.app)

    return no_content()
