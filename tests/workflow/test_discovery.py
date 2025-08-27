import shutil
from pathlib import Path

from virtool.workflow import Workflow
from virtool.workflow.runtime.discover import discover_workflow


def test_discover_workflow(example_path: Path, tmp_path: Path):
    """Test that a workflow can be discovered from a module."""
    shutil.copy(example_path / "workflows/default.py", tmp_path / "workflow.py")

    workflow = discover_workflow(tmp_path / "workflow.py")

    assert isinstance(workflow, Workflow)
    assert len(workflow.steps) == 2
    assert workflow.steps[0].display_name == "Step 1"
    assert workflow.steps[1].display_name == "Step 2"
    assert workflow.steps[0].description == "The first step of the workflow."
    assert workflow.steps[1].description == "The second step of the workflow."
