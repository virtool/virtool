import os

import virtool.db.jobs
import virtool.jobs.job
import virtool.utils
from virtool.api.utils import compose_regex_query, bad_request, json_response, no_content, not_found, paginate, \
    protected


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
        projection=virtool.db.jobs.LIST_PROJECTION,
        processor=virtool.db.jobs.processor
    )

    data["documents"].sort(key=lambda d: d["created_at"])

    return json_response(data)


async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@protected("cancel_job")
async def cancel(req):
    """
    Cancel a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id, ["status"])

    if not document:
        return not_found()

    if not document["status"][-1]["state"] in ["waiting", "running"]:
        return bad_request("Not cancellable")

    await req.app["job_manager"].cancel(job_id)

    document = await db.jobs.find_one(job_id)

    return json_response(virtool.utils.base_processor(document))


@protected("remove_job")
async def remove(req):
    """
    Remove a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id)

    if not document:
        return not_found()

    latest_state = document["status"][-1]["state"]

    if latest_state in ["running", "waiting"]:
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


@protected("remove_job")
async def clear(req):
    db = req.app["db"]

    query = None

    if req.path == "/api/jobs" or req.path == "/api/jobs/finished":
        query = {
            "$or": [
                {"status.state": "error"},
                {"status.state": "cancelled"},
                {"status.state": "complete"}
            ]
        }

    if req.path == "/api/jobs/complete":
        query = {
            "status.state": "complete"
        }

    if req.path == "/api/jobs/failed":
        query = {
            "$or": [
                {"status.state": "error"},
                {"status.state": "cancelled"}
            ]
        }

    removed = list()

    if query is not None:
        removed = await db.jobs.find(query).distinct("_id")
        await db.jobs.delete_many(query)

    return json_response({
        "removed": removed
    })


async def dummy_job(req):
    """
    Submit a dummy job

    """
    data = await req.json()

    task_args = {key: data.get(key, False) for key in ["generate_python_error", "generate_process_error", "long"]}

    task_args["message"] = "hello world"
    task_args["long"] = True
    task_args["use_executor"] = True

    document = await req.app["job_manager"].new(
        "dummy",
        task_args,
        req["client"].user_id or "test"
    )

    return json_response(document)
