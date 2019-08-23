import os

import virtool.jobs.db
import virtool.http.routes
import virtool.jobs
import virtool.resources
import virtool.utils
from virtool.api import compose_regex_query, conflict, json_response, no_content, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/jobs")
async def find(req):
    """
    Return a list of job documents.

    """
    db = req.app["db"]

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["task", "user.id"]))

    data = await paginate(
        db.jobs,
        db_query,
        req.query,
        projection=virtool.jobs.db.PROJECTION,
        processor=virtool.jobs.db.processor
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

    if not virtool.jobs.is_running_or_waiting(document):
        return conflict("Not cancellable")

    await req.app["jobs"].cancel(job_id)

    document = await db.jobs.find_one(job_id)

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/jobs", permission="remove_job")
async def clear(req):
    db = req.app["db"]

    job_filter = req.query.get("filter", None)

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


@routes.get("/api/resources")
async def get_resources(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.resources.get()
    req.app["resources"].update(resources)
    return json_response(resources)
