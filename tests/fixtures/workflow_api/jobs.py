import arrow
from aiohttp.web import RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.jobs.models import JobState, JobStatus
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_jobs_routes(data: WorkflowData):
    routes = RouteTableDef()

    @routes.view("/jobs/claim")
    class ClaimJobView(View):
        async def post(self):
            """Endpoint for testing job claiming via HTTP polling.

            Returns 404 if the job has already been acquired. Tests should set
            ``data.job.acquired = False`` before starting the runtime to make a
            job available for claiming.
            """
            if data.job.acquired:
                return generate_not_found()

            data.job.acquired = True
            data.job.status.append(
                JobStatus(
                    progress=0,
                    state=JobState.PREPARING,
                    timestamp=arrow.utcnow().naive,
                ),
            )

            return json_response(
                {
                    "id": int(data.job.id),
                    "acquired": True,
                    "claim": {
                        "runner_id": "test-runner",
                        "mem": 4.0,
                        "cpu": 2.0,
                        "image": "unknown",
                        "runtime_version": "0.0.0",
                        "workflow_version": "0.0.0",
                    },
                    "claimed_at": arrow.utcnow().naive.isoformat(),
                    "created_at": data.job.created_at.isoformat(),
                    "key": data.job.key,
                    "state": "running",
                    "steps": [],
                    "user": data.job.user.dict(),
                    "workflow": data.job.workflow,
                },
                status=200,
                dumps=custom_dumps,
            )

    @routes.view("/jobs/{job_id}")
    class JobView(View):
        async def get(self):
            """Endpoint for fetching job details."""
            return json_response(
                data.job.dict(),
                status=200,
                dumps=custom_dumps,
            )

        async def patch(self):
            """Endpoint for testing job acquisition."""
            json = await self.request.json()

            if json.get("acquired") is not True:
                return json_response(
                    {"id": "bad_request", "message": "Bad request"},
                    status=400,
                )

            data.job.acquired = True
            data.job.status.append(
                JobStatus(
                    progress=0,
                    state=JobState.PREPARING,
                    timestamp=arrow.utcnow().naive,
                ),
            )

            return json_response(
                data.job.dict(),
                status=200,
                dumps=custom_dumps,
            )

    @routes.view("/jobs/{job_id}/ping")
    class JobPingView(View):
        async def put(self):
            job_id = self.request.match_info["job_id"]

            if job_id != data.job.id:
                return generate_not_found()

            data.job.ping.pinged_at = arrow.utcnow().naive

            return json_response(data.job.ping.dict(), status=200, dumps=custom_dumps)

    @routes.view("/jobs/{job_id}/status")
    class JobStatusView(View):
        async def post(self):
            job_id = self.request.match_info["job_id"]

            if job_id != data.job.id:
                return generate_not_found()

            status = JobStatus(
                **{
                    **(await self.request.json()),
                    "timestamp": arrow.utcnow().naive.isoformat(),
                },
            )

            data.job.status.append(status)

            return json_response(status.dict(), status=201, dumps=custom_dumps)

    return routes
