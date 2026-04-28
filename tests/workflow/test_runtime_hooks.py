import asyncio
from contextlib import suppress
from datetime import datetime

from structlog import get_logger

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


async def test_success(
    clear_hooks, workflow_config: WorkflowConfig, workflow_data: WorkflowData
):
    """Test that the on_success and on_finish hooks are triggered when a workflow
    succeeds.
    """
    workflow_data.job.workflow = "pathoscope"

    wf = Workflow()

    @wf.step
    async def first():
        """Description of the first step."""
        await asyncio.sleep(2)

    success_called = False
    error_called = False
    finish_called = False

    @hooks.on_error(once=True)
    def success_callback():
        nonlocal success_called
        success_called = True

    @hooks.on_success(once=True)
    def success_callback():
        nonlocal success_called
        success_called = True

    @hooks.on_finish(once=True)
    def finish_callback():
        nonlocal finish_called
        finish_called = True

    workflow_data.job.steps = [
        JobStep(
            id=step.function.__name__,
            name=step.display_name,
            description=step.description,
            started_at=None,
        )
        for step in wf.steps
    ]

    await run_workflow(
        workflow_config,
        _make_claimed_job(workflow_data),
        wf,
        Events(),
        get_logger("test"),
    )

    assert success_called
    assert not error_called
    assert finish_called


async def test_error(
    clear_hooks, workflow_config: WorkflowConfig, workflow_data: WorkflowData
):
    """Test that the on_failure and on_finish hooks are triggered when a workflow fails
    due to an error.
    """
    workflow_data.job.workflow = "pathoscope"

    failure_called = False
    finish_called = False

    @hooks.on_failure(once=True)
    def failure_callback():
        nonlocal failure_called
        failure_called = True

    @hooks.on_finish(once=True)
    def finish_callback():
        nonlocal finish_called
        finish_called = True

    wf = Workflow()

    @wf.step
    async def first():
        """Description of the first step."""
        await asyncio.sleep(1)
        raise ValueError("test error")

    workflow_data.job.steps = [
        JobStep(
            id=step.function.__name__,
            name=step.display_name,
            description=step.description,
            started_at=None,
        )
        for step in wf.steps
    ]

    with suppress(Exception):
        await run_workflow(
            workflow_config,
            _make_claimed_job(workflow_data),
            wf,
            Events(),
            get_logger("test"),
        )

    assert failure_called
    assert finish_called
