from typing import List

from aiohttp.web_response import StreamResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.injectors import CONTEXT
from aiohttp_pydantic.oas.typing import r200, r400, r403, r404, r409
from pydantic import Field, conint, ValidationError
from virtool_core.models.job import JobMinimal, JobSearchResult, JobState

from virtool.api.errors import APINotFound, APIBadRequest, APIConflict
from virtool.api.custom_json import json_response
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.api.policy import policy, PermissionRoutePolicy
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.jobs.oas import (
    JobResponse,
    ArchiveJobsRequest,
)

routes = Routes()


@routes.view("/jobs")
class JobsView(PydanticView):
    async def get(
        self,
        archived: bool | None = None,
        page: conint(ge=1) = 1,
        per_page: conint(ge=1, le=100) = 25,
        state: List[JobState] = Field(default_factory=list),
        user: List[str] = Field(default_factory=list),
    ) -> r200[JobSearchResult] | r400:
        """
        Find jobs.

        Lists jobs on the instance.

        Jobs can be filtered by their current ``state`` by providing desired states as
        query parameters.

        **Archived jobs are not currently returned from the API**.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        return json_response(
            await get_data_from_req(self.request).jobs.find(
                archived, page, per_page, state, user
            )
        )

    async def patch(self, data: ArchiveJobsRequest) -> r200[List[JobMinimal]] | r400:
        """
        Update archived field.

        Sets the archived field on job documents.

        Status Codes:
            200: Successful operation
            400: Jobs not found
            400: Archived field not set
            400: Invalid archived field
        """
        job_ids = [job.id for job in data.updates]

        try:
            jobs = await get_data_from_req(self.request).jobs.bulk_archive(job_ids)
        except ResourceNotFoundError as err:
            raise APIBadRequest(str(err))

        return json_response(jobs)

    async def on_validation_error(
        self, exception: ValidationError, context: CONTEXT
    ) -> StreamResponse:
        """
        This method is a hook to intercept ValidationError.

        This hook can be redefined to return a custom HTTP response error.
        The exception is a pydantic.ValidationError and the context is "body",
        "headers", "path" or "query string"
        """
        errors = exception.errors()

        for error in errors:
            error["in"] = context

            if "ctx" in error:
                del error["ctx"]

        return json_response(data=errors, status=400)


@routes.view("/jobs/{job_id}")
class JobView(PydanticView):
    async def get(self, job_id: str, /) -> r200[JobResponse] | r404:
        """
        Get a job.

        Fetches the details for a job.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            document = await get_data_from_req(self.request).jobs.get(job_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(document)


@routes.jobs_api.get("/jobs/{job_id}")
async def get(req):
    """
    Get a job.

    Fetches a job using the 'job id'.
    """
    try:
        document = await get_data_from_req(req).jobs.get(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(document)


@routes.jobs_api.patch("/jobs/{job_id}")
@schema({"acquired": {"type": "boolean", "allowed": [True], "required": True}})
async def acquire(req):
    """
    Sets the acquired field on the job document.

    This is used to let the server know that a job process has accepted the ID and needs
    to have the secure token returned to it. Pushes a status record indicating the job
    is in the 'Preparing' state. This sets an arbitrary progress value of 3 to give
    visual feedback in the UI that the job has started.
    """
    try:
        document = await get_data_from_req(req).jobs.acquire(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError:
        raise APIBadRequest("Job already acquired")

    return json_response(document)


@routes.patch("/jobs/{job_id}/archive")
@routes.jobs_api.patch("/jobs/{job_id}/archive")
async def archive(req):
    """
    Update archived field.

    Sets the archived field on the job document.
    """
    try:
        document = await get_data_from_req(req).jobs.archive(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError:
        raise APIBadRequest("Job already archived")

    return json_response(document)


@routes.view("/jobs/{job_id}/cancel")
class CancelJobView(PydanticView):
    @policy(PermissionRoutePolicy(LegacyPermission.CANCEL_JOB))
    async def put(self, job_id: str, /) -> r200[JobResponse] | r403 | r404 | r409:
        """
        Cancel a job.

        Cancels a job using its 'job id'.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found
            409: Not cancellable
        """
        try:
            document = await get_data_from_req(self.request).jobs.cancel(job_id)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("Job cannot be cancelled in its current state")

        return json_response(document)


@routes.jobs_api.put("/jobs/{job_id}/ping")
async def ping(req):
    """
    Ping a job.

    Updates the ping time on the job. The job will time out if this
    endpoint isn't called at least once every five minutes.
    """
    try:
        job_ping = await get_data_from_req(req).jobs.ping(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(job_ping)


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
                state.value
                for state in (
                    JobState.WAITING,
                    JobState.RUNNING,
                    JobState.COMPLETE,
                    JobState.CANCELLED,
                    JobState.ERROR,
                    JobState.TERMINATED,
                )
            ],
            "required": True,
        },
    }
)
async def push_status(req):
    """
    Push status.

    Push a status update to a job.
    """
    data = req["data"]

    if data["state"] == "error" and not data["error"]:
        raise APIBadRequest("Missing error information")

    try:
        document = await get_data_from_req(req).jobs.push_status(
            req.match_info["job_id"],
            JobState(data["state"]),
            data["stage"],
            data["step_name"],
            data["step_description"],
            data["error"],
            data["progress"],
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError:
        raise APIConflict("Job is finished")

    return json_response(document, status=201)
