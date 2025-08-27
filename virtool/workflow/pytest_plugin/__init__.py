import pytest

import virtool.workflow.runtime.run_subprocess
from tests.fixtures.core import StaticTime, static_time
from virtool.example import example_path
from virtool.workflow import RunSubprocess
from virtool.workflow.pytest_plugin.data import (
    WorkflowData,
    workflow_data,
)


@pytest.fixture
def run_subprocess() -> virtool.workflow.runtime.run_subprocess.RunSubprocess:
    return virtool.workflow.runtime.run_subprocess.run_subprocess()


__all__ = [
    "RunSubprocess",
    "StaticTime",
    "WorkflowData",
    "example_path",
    "run_subprocess",
    "static_time",
    "workflow_data",
]
