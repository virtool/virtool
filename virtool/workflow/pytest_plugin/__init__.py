from pathlib import Path

import arrow
import pytest

import virtool.workflow.runtime.run_subprocess
from virtool.workflow.pytest_plugin.data import (
    WorkflowData,
    workflow_data,
)


@pytest.fixture
def run_subprocess() -> virtool.workflow.runtime.run_subprocess.RunSubprocess:
    return virtool.workflow.runtime.run_subprocess.run_subprocess()


@pytest.fixture
def static_datetime():
    return arrow.get(2020, 1, 1, 1, 1, 1).naive


__all__ = [
    "WorkflowData",
    "example_path",
    "run_subprocess",
    "static_datetime",
    "workflow_data",
]
