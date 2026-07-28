from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404, r409

from virtool.api.custom_json import json_response
from virtool.api.errors import APIConflict, APINotFound
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.jobs.models import (
    CreateJobClaimRequest,
    Job,
    JobClaimed,
    JobCounts,
    JobPing,
    JobStepStarted,
    Workflow,
)

routes = Routes()


@routes.jobs_api.view("/jobs/counts")
class JobsCountsView(PydanticView):
    @policy(PublicRoutePolicy)
    async def get(self) -> r200[JobCounts]:
        """Get job counts.

        Returns job counts grouped by state and workflow.

        Status Codes:
            200: Successful operation
        """
        return json_response(await get_data_from_req(self.request).jobs.get_counts())


@routes.jobs_api.view("/jobs/{job_id}")
class JobsAPIJobView(PydanticView):
    async def get(self, job_id: int, /) -> r200[Job] | r404:
        """Get a job.

        Fetches a job using the 'job id'.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            document = await get_data_from_req(self.request).jobs.get(job_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(document)


@routes.jobs_api.view("/jobs/claim")
class ClaimJobView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(
        self, body: CreateJobClaimRequest, workflow: Workflow
    ) -> r200[JobClaimed] | r404:
        """Claim an available job for a runner.

        Finds the oldest unclaimed job for the given workflow, claims it, and
        returns a secret key for authentication.

        Status Codes:
            200: Successful operation
            404: No job available
        """
        try:
            claimed = await get_data_from_req(self.request).jobs.claim(
                workflow,
                body,
            )
        except ResourceNotFoundError:
            raise APINotFound("No job available")

        return json_response(claimed)


@routes.jobs_api.view("/jobs/{job_id}/steps/{step_id}/start")
class StartJobStepView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(
        self, job_id: int, step_id: str, /
    ) -> r200[JobStepStarted] | r404 | r409:
        """Start a job step.

        Records the start time for a workflow step.

        Status Codes:
            200: Successful operation
            404: Job or step not found
            409: Job in terminal state or step already started
        """
        try:
            step_status = await get_data_from_req(self.request).jobs.start_step(
                job_id, step_id
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as e:
            raise APIConflict(str(e))

        return json_response(step_status)


@routes.jobs_api.view("/jobs/{job_id}/finish")
class FinishJobView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(self, job_id: int, /) -> r200[Job] | r404 | r409:
        """Finish a job.

        Marks a job as succeeded.

        Status Codes:
            200: Successful operation
            404: Job not found
            409: Job is not in a running state
        """
        try:
            job = await get_data_from_req(self.request).jobs.finish(job_id)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as e:
            raise APIConflict(str(e))

        return json_response(job)


@routes.jobs_api.view("/jobs/{job_id}/ping")
class JobPingView(PydanticView):
    async def put(self, job_id: int, /) -> r200[JobPing] | r404:
        """Ping a job.

        Updates the ping time on the job. The job will time out if this
        endpoint isn't called at least once every five minutes.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            job_ping = await get_data_from_req(self.request).jobs.ping(job_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(job_ping)
