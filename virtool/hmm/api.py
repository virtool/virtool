"""
API request handlers for managing and querying HMM data.

"""
import aiohttp
from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest, HTTPBadGateway, HTTPNotFound
from aiohttp.web_fileresponse import FileResponse

import virtool.hmm.db
import virtool.http.routes
from virtool.api.response import conflict, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.db.utils import get_one_field
from virtool.errors import GitHubError
from virtool.github import create_update_subdocument
from virtool.hmm.db import generate_annotations_json_file
from virtool.hmm.tasks import HMMInstallTask
from virtool.hmm.utils import hmm_data_exists
from virtool.utils import base_processor, rm, compress_file_with_gzip

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
    """
    Get the status of the HMM data. Contains the following fields:

    - `errors`: lists any errors in the HMM data
    - `id`: is always 'hmm'
    - `installed`: a dict describing the installed HMM data
    - `process.id`: the ID of the process installing the HMM data
    - `release`: a dict describing the latest available release

    Installed HMM data cannot currently be updated.

    :param req:
    :return:
    """
    db = req.app["db"]
    status = await virtool.hmm.db.get_status(db)
    return json_response(status)


@routes.get("/api/hmms/status/release")
async def get_release(req):
    """
    Get the latest release for the HMM data.

    """
    try:
        release = await virtool.hmm.db.fetch_and_update_release(req.app)
    except GitHubError as err:
        if "404" in str(err):
            raise HTTPBadGateway(text="GitHub repository does not exist")

        raise

    except aiohttp.ClientConnectorError:
        raise HTTPBadGateway(text="Could not reach GitHub")

    if release is None:
        raise HTTPNotFound(text="Release not found")

    return json_response(release)


@routes.get("/api/hmms/status/updates")
async def list_updates(req):
    """
    List all updates applied to the HMM collection.

    """
    db = req.app["db"]

    updates = await get_one_field(db.status, "updates", "hmm") or list()
    updates.reverse()

    return json_response(updates)


@routes.post("/api/hmms/status/updates", permission="modify_hmm")
async def install(req):
    """
    Install the latest official HMM database from GitHub.

    """
    db = req.app["db"]

    user_id = req["client"].user_id

    if await db.status.count_documents({"_id": "hmm", "updates.ready": False}):
        return conflict("Install already in progress")

    release = await get_one_field(db.status, "release", "hmm")

    if release is None:
        raise HTTPBadRequest(text="Target release does not exist")

    task = await req.app["tasks"].add(
        HMMInstallTask,
        context={
            "user_id": user_id,
            "release": release
        }
    )

    await db.status.find_one_and_update({"_id": "hmm"}, {
        "$set": {
            "task": {
                "id": task["id"]
            }
        }
    })

    update = create_update_subdocument(release, False, user_id)

    await db.status.update_one({"_id": "hmm"}, {
        "$push": {
            "updates": update
        }
    })

    return json_response(update)


@routes.get("/api/hmms/{hmm_id}")
@routes.jobs_api.get("/api/hmms/{hmm_id}")
async def get(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document is None:
        raise HTTPNotFound(text="Not found")

    return json_response(base_processor(document))


@routes.delete("/api/hmms", permission="modify_hmm")
async def purge(req):
    """
    Delete all unreferenced HMMs and hide the rest.

    """
    db = req.app["db"]

    await virtool.hmm.db.purge(db, req.app["settings"])

    hmm_path = req.app["settings"]["data_path"] / "hmm/profiles.hmm"

    try:
        await req.app["run_in_thread"](rm, hmm_path)
    except FileNotFoundError:
        pass

    await db.status.find_one_and_update({"_id": "hmm"}, {
        "$set": {
            "installed": None,
            "task": None,
            "updates": list()
        }
    })

    await virtool.hmm.db.fetch_and_update_release(req.app)

    raise HTTPNoContent


@routes.jobs_api.get("/api/hmms/files/annotations.json.gz")
async def get_hmm_annotations(request):
    """Get a compressed json file containing the database documents for all HMMs."""
    data_path = request.app["settings"]["data_path"]
    annotation_path = data_path / "hmm/annotations.json.gz"

    if not annotation_path.exists():
        json_path = await generate_annotations_json_file(request.app)
        await request.app["run_in_thread"](compress_file_with_gzip,
                                           json_path, annotation_path)

    return FileResponse(annotation_path)


@routes.jobs_api.get("/api/hmms/files/profiles.hmm")
async def get_hmm_profiles(req):
    """
    Download the HMM profiles file if HMM data is available.

    """
    file_path = req.app["settings"]["data_path"] / "hmm" / "profiles.hmm"

    if not await req.app["run_in_thread"](hmm_data_exists, file_path):
        raise HTTPNotFound(text="Profiles file could not be found")

    headers = {
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)
