from pyfixtures import fixture
from structlog import get_logger

from virtool.jobs.models import Job, JobClaimed, JobWithKey
from virtool.workflow import WorkflowStep
from virtool.workflow.client import WorkflowAPIClient

logger = get_logger("api")


@fixture
async def job(_api: WorkflowAPIClient, _job: JobWithKey | JobClaimed) -> Job:
    job_json = await _api.get_json(f"/jobs/{_job.id}")
    return Job(**job_json)


@fixture(scope="function")
async def start_step(
    _api: WorkflowAPIClient,
    _job: JobWithKey | JobClaimed,
    _step: WorkflowStep | None,
):
    async def func():
        if _step is not None:
            await _api.post_json(
                f"/jobs/{_job.id}/steps/{_step.function.__name__}/start",
                {},
            )
            logger.info("reported step start to api", step=_step.display_name)

    return func
