from pathlib import Path

import pytest
from pyfixtures import FixtureScope

from virtool.workflow.data.analyses import WFAnalysis
from virtool.workflow.errors import JobsAPIConflictError, JobsAPINotFoundError
from virtool.workflow.pytest_plugin.data import WorkflowData


async def test_ok(scope: FixtureScope, workflow_data: WorkflowData):
    """Test that the analysis fixture returns an Analysis object with the expected values."""
    workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

    analysis = await scope.instantiate_by_key("analysis")

    assert analysis.id == workflow_data.analysis.id


async def test_not_found(scope: FixtureScope, workflow_data: WorkflowData):
    """Test that JobsAPINotFound is raised if the analysis does not exist."""
    workflow_data.job.args["analysis_id"] = "not_found"

    with pytest.raises(JobsAPINotFoundError) as err:
        await scope.instantiate_by_key("analysis")


async def test_upload_file(
    captured_uploads_path: Path,
    scope: FixtureScope,
    work_path: Path,
    workflow_data: WorkflowData,
):
    """Test that the ``Analysis`` object returned by the fixture can be used to upload an
    analysis file.
    """
    workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

    analysis: WFAnalysis = await scope.instantiate_by_key("analysis")

    path = work_path / "blank.txt"

    with open(path, "w") as f:
        f.write("hello world")

    await analysis.upload_file(path, "unknown")

    assert (captured_uploads_path / "blank.txt").read_text() == "hello world"


async def test_delete(scope: FixtureScope, workflow_data: WorkflowData):
    """Test that the analysis fixture can be used to delete the analysis it represents."""
    workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
    workflow_data.analysis.ready = False

    analysis: WFAnalysis = await scope.instantiate_by_key("analysis")

    assert workflow_data.analysis is not None

    await analysis.delete()

    assert workflow_data.analysis is None


async def test_delete_finalized(scope: FixtureScope, workflow_data: WorkflowData):
    """Test that the analysis fixture raises an error if the analysis is finalized."""
    workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
    workflow_data.analysis.ready = True

    analysis: WFAnalysis = await scope.instantiate_by_key("analysis")

    with pytest.raises(JobsAPIConflictError) as err:
        await analysis.delete()

    assert "Analysis is finalized" in str(err)


async def test_result_upload():
    """Test that the analysis fixture can be used to set the analysis result."""
