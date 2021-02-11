import os

import virtool.api.utils
import virtool.http.routes
import virtool.jobs.db
import virtool.users.db
import virtool.utils
from virtool.api.response import bad_request, conflict, json_response, no_content, not_found
from virtool.db.utils import get_one_field
from virtool.jobs.db import PROJECTION
from virtool.utils import base_processor

routes = virtool.http.routes.Routes()


@routes.get("/api/jobs")
async def find(req):
    """
    Return a list of job documents.

    """
    db = req.app["db"]

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(virtool.api.utils.compose_regex_query(term, ["task", "user.id"]))

    data = await virtool.api.utils.paginate(
        db.jobs,
        db_query,
        req.query,
        projection=virtool.jobs.db.LIST_PROJECTION
    )

    data["documents"].sort(key=lambda d: d["created_at"])

    return json_response(data)


@routes.get("/api/jobs/{job_id}", allow_jobs=True)
async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id, projection=PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.patch("/api/jobs/{job_id}", schema={
    "acquired": {
        "type": "boolean",
        "allowed": [True],
        "required": True
    }
})
async def update(req):
    """
    Sets the started field on the job document.

    This is used to let the server know that a job process has accepted the ID and needs to have
    the secure token returned to it.

    """
    db = req["db"]

    job_id = req.match_info["job_id"]

    if await get_one_field(db.jobs, "acquired", job_id) is True:
        return bad_request("Job already acquired")

    document = await virtool.jobs.db.acquire(db, job_id)

    return json_response(base_processor(document))


@routes.put("/api/jobs/{job_id}/cancel", permission="cancel_job")
async def cancel(req):
    """
    Cancel a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id, ["status"])

    if not document:
        return not_found()

    if not virtool.jobs.is_running_or_waiting(document):
        return conflict("Not cancellable")

    document = await req.app["jobs"].cancel(job_id)

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/jobs", permission="remove_job")
async def clear(req):
    db = req.app["db"]

    job_filter = req.query.get("filter")

    # Remove jobs that completed successfully.
    complete = job_filter in [None, "finished", "complete"]

    # Remove jobs that errored or were cancelled.
    failed = job_filter in [None, "finished", "failed"]

    removed = await virtool.jobs.db.clear(db, complete=complete, failed=failed)

    return json_response({
        "removed": removed
    })


@routes.delete("/api/jobs/{job_id}", permission="remove_job")
async def remove(req):
    """
    Remove a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id)

    if not document:
        return not_found()

    if virtool.jobs.is_running_or_waiting(document):
        return conflict("Job is running or waiting and cannot be removed")

    # Removed the documents associated with the job ids from the database.
    await db.jobs.delete_one({"_id": job_id})

    try:
        # Calculate the log path and remove the log file. If it exists, return True.
        path = os.path.join(req.app["settings"]["data_path"], "logs", "jobs", job_id + ".log")
        await req.app["run_in_thread"](virtool.utils.rm, path)
    except OSError:
        pass

    return no_content()
