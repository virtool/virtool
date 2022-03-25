from logging import getLogger

from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent

import virtool.jobs.db
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.db.transforms import apply_transforms
from virtool.db.utils import get_one_field
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs import is_running_or_waiting
from virtool.jobs.db import (
    LIST_PROJECTION,
    PROJECTION,
    compose_status,
    delete,
    processor,
)
from virtool.users.db import AttachUserTransform

logger = getLogger(__name__)

routes = Routes()


@routes.get("/jobs")
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
        db.jobs, db_query, req.query, projection=LIST_PROJECTION, sort="created_at"
    )

    documents = await apply_transforms(data["documents"], [AttachUserTransform(db)])

    return json_response({**data, "documents": documents})


@routes.get("/jobs/{job_id}")
@routes.jobs_api.get("/jobs/{job_id}")
async def get(req):
    """
    Return the complete document for a given job.

    """
    db = req.app["db"]
    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id, projection=PROJECTION)

    if not document:
        raise NotFound()

    return json_response(await processor(db, document))


@routes.patch("/jobs/{job_id}")
@routes.jobs_api.patch("/jobs/{job_id}")
@schema({"acquired": {"type": "boolean", "allowed": [True], "required": True}})
async def acquire(req):
    """
    Sets the acquired field on the job document.

    This is used to let the server know that a job process has accepted the ID and needs
    to have the secure token returned to it.

    Pushes a status record indicating the job is in the 'Preparing' state. This sets an
    arbitrary progress value of 3 to give visual feedback in the UI that the job has
    started.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    acquired = await get_one_field(db.jobs, "acquired", job_id)

    if acquired is True:
        raise HTTPBadRequest(text="Job already acquired")

    if acquired is None:
        raise NotFound()

    document = await virtool.jobs.db.acquire(db, job_id)

    return json_response(await processor(db, document))


@routes.put("/jobs/{job_id}/cancel", permission="cancel_job")
async def cancel(req):
    """
    Cancel a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.jobs.find_one(job_id, ["status"])

    if not document:
        raise NotFound()

    if not virtool.jobs.is_running_or_waiting(document):
        raise HTTPConflict(text="Not cancellable")

    document = await req.app["jobs"].cancel(job_id)

    return json_response(await processor(db, document))


@routes.post("/jobs/{job_id}/status")
@routes.jobs_api.post("/jobs/{job_id}/status")
@schema(
    {
        "error": {
            "type": "dict",
            "default": None,
            "nullable": True,
            "schema": {
                "type": {"type": "string", "required": True},
                "traceback": {
                    "type": "list",
                    "schema": {"type": "string"},
                    "required": True,
                },
                "details": {
                    "type": "list",
                    "schema": {"type": "string"},
                    "required": True,
                },
            },
        },
        "progress": {"type": "integer", "required": True, "min": 0, "max": 100},
        "stage": {
            "type": "string",
            "required": True,
        },
        "step_name": {"type": "string", "default": None, "nullable": True},
        "step_description": {"type": "string", "default": None, "nullable": True},
        "state": {
            "type": "string",
            "allowed": [
                "waiting",
                "running",
                "complete",
                "cancelled",
                "error",
                "terminated",
            ],
            "required": True,
        },
    }
)
async def push_status(req):
    """
    Push a status update to a job.

    """
    db = req.app["db"]
    data = req["data"]

    job_id = req.match_info["job_id"]

    status = await get_one_field(db.jobs, "status", job_id)

    if status is None:
        raise NotFound()

    if status[-1]["state"] in ("complete", "cancelled", "error", "terminated"):
        raise HTTPConflict(text="Job is finished")

    if data["state"] == "error" and not data["error"]:
        raise HTTPBadRequest(text="Missing error information")

    document = await db.jobs.find_one_and_update(
        {"_id": job_id},
        {
            "$set": {"state": data["state"]},
            "$push": {
                "status": compose_status(
                    data["state"],
                    data["stage"],
                    data["step_name"],
                    data["step_description"],
                    data["error"],
                    data["progress"],
                )
            },
        },
    )

    return json_response(document["status"][-1], status=201)


@routes.delete("/jobs", permission="remove_job")
async def clear(req):
    db = req.app["db"]

    job_filter = req.query.get("filter")

    # Remove jobs that completed successfully.
    complete = job_filter in [None, "finished", "complete"]

    # Remove jobs that errored or were cancelled.
    failed = job_filter in [None, "failed", "finished" "terminated"]

    removed = await virtool.jobs.db.clear(db, complete=complete, failed=failed)

    return json_response({"removed": removed})


@routes.delete("/jobs/{job_id}", permission="remove_job")
async def remove(req):
    """
    Remove a job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].jobs.find_one(job_id)

    if not document:
        raise NotFound()

    if is_running_or_waiting(document):
        raise HTTPConflict(text="Job is running or waiting and cannot be removed")

    await delete(req.app, job_id)

    raise HTTPNoContent
