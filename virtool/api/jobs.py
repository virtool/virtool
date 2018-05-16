import os

import virtool.db.jobs
import virtool.http.routes
import virtool.jobs.job
import virtool.jobs.utils
import virtool.resources
import virtool.utils
from virtool.api.utils import compose_regex_query, bad_request, json_response, no_content, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/jobs")
async def find(req):
    """
    Return a list of job documents.

    """
    db = req.app["db"]

    term = req.query.get("term", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["task", "user.id"]))

    data = await paginate(
        db.jobs,
        db_query,
        req.query,
        projection=virtool.db.jobs.PROJECTION,
        processor=virtool.db.jobs.processor
    )

    data["documents"].sort(key=lambda d: d["created_at"])

    return json_response(data)


@routes.get("/api/jobs/{job_id}")
async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


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

    if not virtool.jobs.utils.is_running_or_waiting(document):
        return bad_request("Not cancellable")

    await req.app["job_manager"].cancel(job_id)

    document = await db.jobs.find_one(job_id)

    return json_response(virtool.utils.base_processor(document))


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

    if virtool.jobs.utils.is_running_or_waiting(document):
        return json_response({
            "id": "conflict",
            "message": "Job is running or waiting and cannot be removed"
        }, status=409)

    # Removed the documents associated with the job ids from the database.
    await db.jobs.delete_one({"_id": job_id})

    try:
        # Calculate the log path and remove the log file. If it exists, return True.
        path = os.path.join(req.app["settings"].get("data_path"), "logs", "jobs", job_id + ".log")
        await virtool.utils.rm(path)
    except OSError:
        pass

    return no_content()


@routes.delete("/api/jobs", permission="remove_job")
async def clear(req):
    db = req.app["db"]

    path = req.path

    # Remove jobs that completed successfully.
    complete = path == "/api/jobs" or path == "/api/jobs/finished" or path == "/api/jobs/complete"

    # Remove jobs that errored or were cancelled.
    failed = path == "/api/jobs" or path == "/api/jobs/finished" or path == "/api/jobs/failed"

    removed = await virtool.db.jobs.clear(db, complete=complete, failed=failed)

    return json_response({
        "removed": removed
    })


@routes.get("/api/resources")
async def get_resources(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.resources.get()
    req.app["resources"] = resources

    return json_response(resources)
