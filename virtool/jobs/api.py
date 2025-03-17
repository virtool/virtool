from pydantic import Field
from virtool_core.models.job import JobSearchResult, JobState

from virtool.api.custom_json import json_response
from virtool.api.errors import APIConflict, APINotFound
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R400, R403, R404, R409
from virtool.api.view import APIView
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.jobs.oas import (
    JobArchiveRequest,
    JobCreateStatusRequest,
    JobResponse,
)
from virtool.validation import is_set

routes = Routes()


@routes.web.view("/jobs")
class JobsView(APIView):
    async def get(
        self,
        state: list[JobState],
        user: list[str],
        archived: bool | None = None,
        page: int = Field(default=1, ge=1),
        per_page: int = Field(default=25, ge=1, le=100),
    ) -> R200[JobSearchResult] | R400:
        """Find jobs.

        Lists jobs on the instance.

        Jobs can be filtered by their current ``state`` by providing desired states as
        query parameters.

        **Archived jobs are not currently returned from the API**.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        return json_response(
            await self.data.jobs.find(
                archived,
                page,
                per_page,
                state,
                user,
            ),
        )


@routes.job.view("/jobs/{job_id}")
@routes.web.get("/jobs/{job_id}")
class JobView(APIView):
    async def get(self, job_id: str, /) -> R200[JobResponse] | R404:
        """Get a job.

        Fetches the details for a job.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            document = await self.data.jobs.get(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None

        return json_response(document)

    async def patch(self, job_id: str, /) -> R200[JobResponse] | R404:
        """Acquire a job.

        Making a request to this endpoint tells the server that a job process has
        accepted the ID and needs to have the secure token returned to it.

        Once the job is acquired, a record is appended to the ``status`` log indicating
        that the job is in the 'Preparing' state. The `acquired` field for the job is
        set from `False` to `True`.

        Status Codes:
            200: Successful operation
            404: Not found
            409: Job already acquired

        TODO: Remove this endpoint. It is replaced by `PUT /jobs/:id/acquire`.
        """
        try:
            document = await self.data.jobs.acquire(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None
        except ResourceConflictError:
            raise APIConflict("Job already acquired") from None

        return json_response(document)


@routes.job.view("/jobs/{job_id}/acquire")
class JobAcquireView(APIView):
    async def put(self, job_id: str, /) -> R200[JobResponse] | R404:
        """Acquire a job.

        Making a request to this endpoint tells the server that a job process has
        accepted the ID and needs to have the secure token returned to it.

        Once the job is acquired, a record is appended to the ``status`` log indicating
        that the job is in the 'Preparing' state. The `acquired` field for the job is
        set from `False` to `True`.

        Status Codes:
            200: Successful operation
            404: Not found
            409: Job already acquired

        """
        try:
            document = await self.data.jobs.acquire(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None
        except ResourceConflictError:
            raise APIConflict("Job already acquired") from None

        return json_response(document)


@routes.web.view("/jobs/{job_id}/archive")
class JobArchiveView(APIView):
    async def archive(
        self,
        job_id: str,
        data: JobArchiveRequest,
    ) -> R200[JobResponse] | R400 | R404:
        """Update archived field.

        Sets the archived field on the job document.

        Status Codes:
            200: Successful operation
            400: Job already archived
            404: Not found
        """
        if is_set(data.archived):
            try:
                await self.data.jobs.archive(job_id, data.archived)
            except ResourceNotFoundError:
                raise APINotFound from None
            except ResourceConflictError:
                pass

        try:
            job = await self.data.jobs.get(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None

        return json_response(job)


@routes.web.view("/jobs/{job_id}/cancel")
class JobCancelView(APIView):
    @policy(PermissionRoutePolicy(LegacyPermission.CANCEL_JOB))
    async def put(self, job_id: str, /) -> R200[JobResponse] | R403 | R404 | R409:
        """Cancel a job.

        Cancels a job using its 'job id'.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found
            409: Not cancellable
        """
        try:
            document = await self.data.jobs.cancel(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None
        except ResourceConflictError:
            raise APIConflict("Job cannot be cancelled in its current state") from None

        return json_response(document)


@routes.job.view("/jobs/{job_id}/ping")
class JobPingView(APIView):
    async def put(self, job_id: str) -> R200[JobResponse] | R404:
        """Ping a job.

        Updates the ping time on the job. The job will time out if this
        endpoint isn't called at least once every five minutes.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            job_ping = await self.data.jobs.ping(job_id)
        except ResourceNotFoundError:
            raise APINotFound from None

        return json_response(job_ping)


@routes.job.view("/jobs/{job_id}/status")
class JobStatusView(APIView):
    async def post(
        self,
        job_id: str,
        /,
        status: JobCreateStatusRequest,
    ) -> R201[JobResponse] | R404 | R409:
        """Push status.

        Push a status update to a job.

        Status Codes:
            201: Successful operation
            404: Not found
            409: Job is finished
        """
        try:
            status = await self.data.jobs.push_status(
                job_id,
                status.state,
                status.stage,
                status.step_name,
                status.step_description,
                status.error,
                status.progress,
            )
        except ResourceNotFoundError:
            raise APINotFound from None
        except ResourceConflictError:
            raise APIConflict("Job is finished") from None

        return json_response(status, status=201)
