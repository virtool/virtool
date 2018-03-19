import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.app_settings
import virtool.utils


@pytest.mark.parametrize("default", [True, False])
def test_get_default_boolean(default):
    assert virtool.app_settings.get_default_boolean(default) == {
        "type": "boolean",
        "coerce": virtool.utils.to_bool,
        "default": default
    }


@pytest.mark.parametrize("default", [1, 3, 4, 5])
def test_get_default_integer(default):
    assert virtool.app_settings.get_default_integer(default) == {
        "type": "integer",
        "coerce": int,
        "default": default
    }


@pytest.mark.parametrize("proc, mem, error_message", [
    (4, 8, None),
    (5, 8, "Exceeds system processor count"),
    (4, 12, "Exceeds system memory"),
    (3, 8, "Less than a task-specific proc limit"),
    (4, 7, "Less than a task-specific mem limit")
])
def test_check_resource_limits(proc, mem, error_message, mocker):
    return_value = {
        "proc": [0, 0, 0, 0],
        "mem": {
            "total": 9000000000
        }
    }

    settings = {
        "pathoscope_bowtie_proc": 4,
        "pathoscope_bowtie_mem": 8,
        "nuvs_proc": 4,
        "nuvs_mem": 8,
        "create_sample_proc": 4,
        "create_sample_mem": 4,
        "create_subtraction_proc": 2,
        "create_subtraction_mem": 4,
        "rebuild_index_proc": 2,
        "rebuild_index_mem": 4
    }

    m_get_resources = mocker.patch("virtool.job_resources.get", return_value=return_value)

    assert virtool.app_settings.check_resource_limits(proc, mem, settings) == error_message
