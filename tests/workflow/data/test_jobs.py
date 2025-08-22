from pyfixtures import FixtureScope
from syrupy import SnapshotAssertion

from virtool.jobs.models import Job
from virtool.workflow.pytest_plugin.data import WorkflowData


async def test_ok(
    scope: FixtureScope,
    snapshot: SnapshotAssertion,
    workflow_data: WorkflowData,
):
    workflow_data.job.acquired = False

    job: Job = await scope.get_or_instantiate("job")

    assert job.dict() == snapshot(name="pydantic")
