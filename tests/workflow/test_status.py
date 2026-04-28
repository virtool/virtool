import asyncio
from datetime import datetime

from structlog import get_logger
from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import (
    JobClaim,
    JobClaimed,
    JobState,
    JobStep,
)
from virtool.jobs.models import (
    Workflow as WorkflowModel,
)
from virtool.workflow import Workflow, hooks
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.runtime.events import Events
from virtool.workflow.runtime.run import run_workflow


def _make_claimed_job(workflow_data: WorkflowData) -> JobClaimed:
    """Build a JobClaimed object from workflow test data."""
    return JobClaimed(
        id=int(workflow_data.job.id),
        acquired=True,
        claim=JobClaim(
            runner_id="test-runner",
            mem=4.0,
            cpu=2.0,
            image="unknown",
            runtime_version="0.0.0",
            workflow_version="0.0.0",
        ),
        claimed_at=datetime.now(tz=None),
        created_at=workflow_data.job.created_at,
        key=workflow_data.job.key,
        state=JobState.RUNNING,
        steps=[],
        user=workflow_data.job.user,
        workflow=WorkflowModel(workflow_data.job.workflow),
    )


async def test_ok(
    snapshot: SnapshotAssertion,
    workflow_data: WorkflowData,
    workflow_config: WorkflowConfig,
):
    """Test that status is reported normally in a successful workflow run."""
    wf = Workflow()

    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.state = JobState.RUNNING

    @wf.step
    async def first():
        """Description of First."""
        assert workflow_data.step_start_updates[-1]["id"] == "first"
        assert workflow_data.step_start_updates[-1]["name"] == "First"
        assert (
            workflow_data.step_start_updates[-1]["description"]
            == "Description of First."
        )

        await asyncio.sleep(1)

    @wf.step
    async def second():
        """Description of Second."""
        assert workflow_data.step_start_updates[-1]["id"] == "second"
        assert workflow_data.step_start_updates[-1]["name"] == "Second"
        assert (
            workflow_data.step_start_updates[-1]["description"]
            == "Description of Second."
        )

        await asyncio.sleep(2)

    on_success_called = False
    workflow_data.job.steps = [
        JobStep(
            id=step.function.__name__,
            name=step.display_name,
            description=step.description,
            started_at=None,
        )
        for step in wf.steps
    ]

    @hooks.on_success(once=True)
    async def check_success_status():
        nonlocal on_success_called
        on_success_called = True

        await asyncio.sleep(0.1)

    await run_workflow(
        workflow_config,
        _make_claimed_job(workflow_data),
        wf,
        Events(),
        get_logger("test"),
    )

    assert on_success_called is True

    assert workflow_data.step_start_updates == snapshot(
        name="step_starts",
        exclude=props("started_at"),
    )


async def test_error(
    snapshot: SnapshotAssertion,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    """Test that an error raised in workflow step is reported."""
    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.state = JobState.RUNNING

    wf = Workflow()

    error = ValueError()

    @wf.step
    def raise_error():
        """Raise and error for testing purposes."""
        raise error

    workflow_data.job.steps = [
        JobStep(
            id=step.function.__name__,
            name=step.display_name,
            description=step.description,
            started_at=None,
        )
        for step in wf.steps
    ]

    error_hook_called = False

    @hooks.on_error(once=True)
    async def check_error_update_sent():
        nonlocal error_hook_called

        await asyncio.sleep(0.1)

        error_hook_called = True

    failure_hook_called = False

    @hooks.on_failure(once=True)
    async def check_failure_hook_called():
        nonlocal failure_hook_called
        failure_hook_called = True

    await run_workflow(
        workflow_config,
        _make_claimed_job(workflow_data),
        wf,
        Events(),
        get_logger("test"),
    )

    assert error_hook_called is True
    assert failure_hook_called is True

    assert workflow_data.step_start_updates == snapshot(
        name="step_starts",
        exclude=props("started_at"),
    )
