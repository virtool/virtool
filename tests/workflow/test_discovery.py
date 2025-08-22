import shutil
from pathlib import Path

from virtool.workflow import Workflow
from virtool.workflow.runtime.discover import discover_workflow


def test_discover_workflow(example_path: Path, tmp_path: Path):
    """Test that a workflow can be discovered from a module."""
    shutil.copy(example_path / "workflows/try_fastqc.py", tmp_path / "workflow.py")

    workflow = discover_workflow(tmp_path / "workflow.py")

    assert isinstance(workflow, Workflow)
    assert len(workflow.steps) == 2
    assert workflow.steps[0].display_name == "Step 1"
    assert workflow.steps[1].display_name == "Try Fastqc"
    assert (
        workflow.steps[0].description
        == "A basic step that doesn't actually do anything."
    )
    assert (
        workflow.steps[1].description
        == "Make sure the FastQC fixture works in a real workflow run."
    )
