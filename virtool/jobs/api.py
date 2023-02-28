from logging import getLogger
from typing import Union, List, Optional

from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400, r403, r404, r409
from pydantic import Field, conint
from virtool_core.models.job import JobMinimal, JobSearchResult, JobState

from virtool.api.response import NotFound, json_response
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, PermissionRoutePolicy
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs.oas import (
    JobResponse,
    ArchiveJobsRequest,
)

logger = getLogger(__name__)

routes = Routes()


@routes.view("/jobs")
class JobsView(PydanticView):
    async def get(
        self,
        archived: Optional[bool] = None,
        page: conint(ge=1) = 1,
        per_page: conint(ge=1, le=100) = 25,
        state: List[JobState] = Field(default_factory=list),
        user: List[str] = Field(default_factory=list),
    ) -> Union[r200[JobSearchResult], r400]:
        """
        Find jobs.

        Finds jobs on the instance.

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

    async def patch(
        self, data: ArchiveJobsRequest
    ) -> Union[r200[List[JobMinimal]], r400]:
        """
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
            raise HTTPBadRequest(text=str(err))

        return json_response(jobs)


@routes.view("/jobs/{job_id}")
class JobView(PydanticView):
    async def get(self, job_id: str, /) -> Union[r200[JobResponse], r404]:
        """
        Get a job.

        Retrieves the details for a job.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            document = await get_data_from_req(self.request).jobs.get(job_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(document)


@routes.jobs_api.get("/jobs/{job_id}")
async def get(req):
    """
    Get a job.

    """
    try:
        document = await get_data_from_req(req).jobs.get(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise NotFound()

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
        raise NotFound()
    except ResourceConflictError:
        raise HTTPBadRequest(text="Job already acquired")

    return json_response(document)


@routes.patch("/jobs/{job_id}/archive")
@routes.jobs_api.patch("/jobs/{job_id}/archive")
async def archive(req):
    """
    Sets the archived field on the job document.
    """
    try:
        document = await get_data_from_req(req).jobs.archive(req.match_info["job_id"])
    except ResourceNotFoundError:
        raise NotFound()
    except ResourceConflictError:
        raise HTTPBadRequest(text="Job already archived")

    return json_response(document)


@routes.view("/jobs/{job_id}/cancel")
class CancelJobView(PydanticView):
    @policy(PermissionRoutePolicy(LegacyPermission.CANCEL_JOB))
    async def put(self, job_id: str, /) -> Union[r200[JobResponse], r403, r404, r409]:
        """
        Cancel a job.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found
            409: Not cancellable
        """
        try:
            document = await get_data_from_req(self.request).jobs.cancel(job_id)
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceConflictError:
            raise HTTPConflict(text="Job cannot be cancelled in its current state")

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
        raise NotFound()
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
    """Push a status update to a job."""
    data = req["data"]

    if data["state"] == "error" and not data["error"]:
        raise HTTPBadRequest(text="Missing error information")

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
        raise NotFound
    except ResourceConflictError:
        raise HTTPConflict(text="Job is finished")

    return json_response(document, status=201)
