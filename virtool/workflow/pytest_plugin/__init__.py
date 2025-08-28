from pathlib import Path

import pytest
from pytest_mock import MockerFixture

import virtool.workflow.runtime.run_subprocess
from virtool.example import example_path as virtool_example_path
from virtool.workflow import RunSubprocess
from virtool.workflow.pytest_plugin.data import (
    WorkflowData,
    workflow_data,
)
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
def example_path() -> Path:
    return virtool_example_path


@pytest.fixture(scope="session")
def static_time_obj() -> StaticTime:
    return StaticTime()


@pytest.fixture
def static_time(mocker: MockerFixture, static_time_obj: StaticTime) -> StaticTime:
    mocker.patch("virtool.utils.timestamp", return_value=static_time_obj.datetime)
    return static_time_obj


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
