import traceback

from pyfixtures import fixture
from structlog import get_logger

from virtool.jobs.models import Job, JobAcquired, JobState
from virtool.workflow import Workflow, WorkflowStep
from virtool.workflow.client import WorkflowAPIClient

MAX_TB = 50

logger = get_logger("api")


@fixture
async def job(_api: WorkflowAPIClient, _job: JobAcquired) -> Job:
    return Job.parse_obj(_job)


@fixture(scope="function")
async def push_status(
    _api: WorkflowAPIClient,
    _job: JobAcquired,
    _error: Exception | None,
    _state: JobState,
    _step: WorkflowStep | None,
    _workflow: Workflow,
):
    error = None

    if _error:
        error = {
            "type": _error.__class__.__name__,
            "traceback": traceback.format_tb(_error.__traceback__, MAX_TB),
            "details": [str(arg) for arg in _error.args],
        }

        logger.info("reporting error to api", error=_error)

    if _state in (JobState.WAITING, JobState.PREPARING):
        progress = 0
    elif _state == JobState.COMPLETE:
        progress = 100
    else:
        progress = (100 // len(_workflow.steps)) * _workflow.steps.index(_step)

    step_name = _step.display_name if _step is not None else ""

    payload = {
        "error": error,
        "progress": progress,
        "stage": _step.function.__name__ if _step is not None else "",
        "state": _state.value,
        "step_description": _step.description if _step is not None else "",
        "step_name": step_name,
    }

    async def func():
        await _api.post_json(f"/jobs/{_job.id}/status", payload)
        logger.info("reported status to api", step=step_name, state=_state)

    return func
