import os
import math
from cerberus import Validator

import virtool.utils
import virtool.job
from virtool.handlers.utils import unpack_request, json_response, bad_request, not_found, invalid_query, \
    compose_regex_query, no_content


async def find(req):
    """
    Return a list of job documents.
     
    """
    db = req.app["db"]

    # Validator for URL query.
    v = Validator({
        "term": {"type": "string", "default": "", "coerce": str},
        "page": {"type": "integer", "coerce": int, "default": 1, "min": 1},
        "per_page": {"type": "integer", "coerce": int, "default": 15, "min": 1, "max": 100}
    })

    if not v(dict(req.query)):
        return invalid_query(v.errors)

    query = v.document

    page = query["page"]
    per_page = query["per_page"]

    db_query = dict()

    if query["term"]:
        db_query.update(compose_regex_query(query["term"], ["task", "user_id"]))

    total_count = await db.jobs.count()

    cursor = db.jobs.find(
        db_query,
        virtool.job.LIST_PROJECTION,
        sort=[("name", 1)]
    )

    found_count = await cursor.count()

    if page > 1:
        cursor.skip((page - 1) * per_page)

    documents = [virtool.job.dispatch_processor(d) for d in await cursor.to_list(per_page)]

    return json_response({
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page": page,
        "per_page": per_page,
        "page_count": int(math.ceil(found_count / per_page))
    })


async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id)

    if not document:
        return not_found()

    return json_response(virtool.job.processor(document))


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

    return json_response(virtool.job.processor(document))


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


async def clear(req):
    db = req.app["db"]

    query = {
        "finished": True
    }

    if req.path == "/api/jobs/complete":
        query["status.state"] = "complete"

    if req.path == "/api/jobs/failed":
        query["$or"] = [
            {"status.state": "error"},
            {"status.state": "cancelled"}
        ]

    if req.path == "/api/jobs/finished":
        query["$or"] = [
            {"status.state": "error"},
            {"status.state": "cancelled"},
            {"status.state": "complete"}
        ]

    removed = await db.jobs.find(query).distinct("_id")

    await db.jobs.delete_many(query)

    return json_response({
        "removed": removed
    })


async def test_job(req):
    """
    Submit a test job

    """
    db, data = await unpack_request(req)

    job_manager = req.app["job_manager"]

    task_args = {key: data.get(key, False) for key in ["generate_python_error", "generate_process_error", "long"]}

    task_args["message"] = "hello world"

    document = await job_manager.new(
        "test_task",
        task_args,
        1,
        4,
        req["session"].user_id or "test"
    )

    return json_response(document)
