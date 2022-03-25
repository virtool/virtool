from logging import getLogger

from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent

from virtool.api.response import NotFound, json_response
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.http.routes import Routes
from virtool.http.schema import schema

logger = getLogger(__name__)

routes = Routes()


@routes.get("/jobs")
async def find(req):
    """
    Return a list of job documents.

    """
    return json_response(await get_data_from_req(req).jobs.find(req.query))


@routes.get("/jobs/{job_id}")
@routes.jobs_api.get("/jobs/{job_id}")
async def get(req):
    """
    Return the complete document for a given job.

    """
    try:
        document = await get_data_from_req(req).jobs.get(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise NotFound()

    return json_response(document)


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
    try:
        document = await get_data_from_req(req).jobs.acquire(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise NotFound()
    except ResourceConflictError:
        raise HTTPBadRequest(text="Job already acquired")

    return json_response(document)


@routes.put("/jobs/{job_id}/cancel", permission="cancel_job")
async def cancel(req):
    """Cancel a job."""
    try:
        document = await get_data_from_req(req).jobs.cancel(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise NotFound
    except ResourceConflictError:
        raise HTTPConflict(text="Job cannot be cancelled in its current state")

    return json_response(document)


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
    """Push a status update to a job."""
    data = req["data"]

    if data["state"] == "error" and not data["error"]:
        raise HTTPBadRequest(text="Missing error information")

    try:
        document = await get_data_from_req(req).jobs.push_status(
            req.match_info["job_id"],
            data["state"],
            data["stage"],
            data["step_name"],
            data["step_description"],
            data["error"],
            data["progress"],
        )
    except ResourceNotFoundError:
        raise NotFound
    except ResourceConflictError:
        raise HTTPConflict(text="Job is finished")

    return json_response(document["status"][-1], status=201)


@routes.delete("/jobs", permission="remove_job")
async def clear(req):
    job_filter = req.query.get("filter")

    # Remove jobs that completed successfully.
    complete = job_filter in [None, "finished", "complete"]

    # Remove jobs that errored or were cancelled.
    failed = job_filter in [None, "failed", "finished" "terminated"]

    removed_job_ids = await get_data_from_req(req).jobs.clear(
        complete=complete, failed=failed
    )

    return json_response({"removed": removed_job_ids})


@routes.delete("/jobs/{job_id}", permission="remove_job")
async def remove(req):
    """
    Remove a job.

    """
    try:
        await get_data_from_req(req).jobs.delete(req.match_info["job_id"])
    except ResourceConflictError:
        raise HTTPConflict(text="Job is running or waiting and cannot be removed")
    except ResourceNotFoundError:
        raise NotFound()

    raise HTTPNoContent
