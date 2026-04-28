import arrow
from aiohttp.web import RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.jobs.models import JobState, JobStep
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_jobs_routes(data: WorkflowData):
    routes = RouteTableDef()

    @routes.view("/jobs/claim")
    class ClaimJobView(View):
        async def post(self):
            """Endpoint for testing job claiming via HTTP polling.

            Returns 404 if the job has already been claimed. Tests should set
            ``data.acquired = False`` before starting the runtime to make a
            job available for claiming.
            """
            if data.acquired:
                return generate_not_found()

            data.acquired = True
            data.job.state = JobState.RUNNING
            body = await self.request.json()
            data.job.steps = [
                JobStep(
                    id=step["id"],
                    name=step["name"],
                    description=step["description"],
                    started_at=None,
                )
                for step in body["steps"]
            ]

            return json_response(
                {
                    "id": data.job.id,
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
                    "steps": [step.dict() for step in data.job.steps],
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

    @routes.view("/jobs/{job_id}/ping")
    class JobPingView(View):
        async def put(self):
            job_id = int(self.request.match_info["job_id"])

            if job_id != data.job.id:
                return generate_not_found()

            data.job.pinged_at = arrow.utcnow().naive

            return json_response(
                {
                    "pinged_at": data.job.pinged_at.isoformat(),
                    "cancelled": data.job.state == JobState.CANCELLED,
                },
                status=200,
                dumps=custom_dumps,
            )

    @routes.view("/jobs/{job_id}/steps/{step_id}/start")
    class JobStepStartView(View):
        async def post(self):
            job_id = int(self.request.match_info["job_id"])
            step_id = self.request.match_info["step_id"]

            if job_id != data.job.id:
                return generate_not_found()

            now = arrow.utcnow().naive

            steps = list(data.job.steps or [])
            step_index = next(
                (i for i, step in enumerate(steps) if step.id == step_id),
                None,
            )

            if step_index is None:
                return generate_not_found()

            steps[step_index].started_at = now
            data.job.steps = steps

            body = steps[step_index].dict()
            data.step_start_updates.append(body)

            return json_response(body, status=200, dumps=custom_dumps)

    return routes
