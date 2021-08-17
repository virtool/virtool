import os

from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest, HTTPConflict

import virtool.jobs.db
import virtool.utils
from virtool.api.response import json_response, not_found
from virtool.api.utils import compose_regex_query, paginate
from virtool.db.utils import get_one_field
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs.db import PROJECTION, LIST_PROJECTION

routes = Routes()


@routes.get("/api/jobs")
async def find(req):
    """
    Return a list of job documents.

    """
    db = req.app["db"]

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["workflow", "user.id"]))

    data = await paginate(
        db.jobs,
        db_query,
        req.query,
        projection=LIST_PROJECTION
    )

    data["documents"].sort(key=lambda d: d["created_at"])

    return json_response(data)


@routes.get("/api/jobs/{job_id}")
@routes.jobs_api.get("/api/jobs/{job_id}")
async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id, projection=PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.patch("/api/jobs/{job_id}")
@routes.jobs_api.patch("/api/jobs/{job_id}")
@schema({
    "acquired": {
        "type": "boolean",
        "allowed": [True],
        "required": True
    }
})
async def acquire(req):
    """
    Sets the acquired field on the job document.

    This is used to let the server know that a job process has accepted the ID and needs to have
    the secure token returned to it.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    if await get_one_field(db.jobs, "acquired", job_id) is True:
        raise HTTPBadRequest(text="Job already acquired")

    document = await virtool.jobs.db.acquire(db, job_id)

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
        raise HTTPConflict(text="Not cancellable")

    document = await req.app["jobs"].cancel(job_id)

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/jobs/{job_id}/status")
@routes.jobs_api.post("/api/jobs/{job_id}/status")
@schema({
    "state": {
        "type": "string",
        "allowed": [
            "waiting",
            "running",
            "complete",
            "cancelled",
            "error"
        ],
        "required": True
    },
    "stage": {
        "type": "string",
        "required": True,
    },
    "progress": {
        "type": "integer",
        "required": True,
        "min": 0,
        "max": 100
    },
    "error": {
        "type": "dict",
        "default": None,
        "nullable": True
    }
})
async def push_status(req):
    db = req.app["db"]
    data = req["data"]

    job_id = req.match_info["job_id"]

    status = await get_one_field(db.jobs, "status", job_id)

    if status is None:
        return not_found()

    if status[-1]["state"] in ("complete", "cancelled", "error"):
        raise HTTPConflict(text="Job is finished")

    document = await db.jobs.find_one_and_update({"_id": job_id}, {
        "$set": {
            "state": data["state"]
        },
        "$push": {
            "status": {
                "state": data["state"],
                "stage": data["stage"],
                "error": data["error"],
                "progress": data["progress"],
                "timestamp": virtool.utils.timestamp()
            }
        }
    })

    return json_response(document["status"][-1], status=201)


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
        raise HTTPConflict(text="Job is running or waiting and cannot be removed")

    # Removed the documents associated with the job ids from the database.
    await db.jobs.delete_one({"_id": job_id})

    try:
        # Calculate the log path and remove the log file. If it exists, return True.
        path = os.path.join(req.app["settings"]["data_path"], "logs", "jobs", job_id + ".log")
        await req.app["run_in_thread"](virtool.utils.rm, path)
    except OSError:
        pass

    raise HTTPNoContent
