import pytest

import virtool.config
import virtool.settings
import virtool.utils


@pytest.mark.parametrize("default", [True, False])
def test_get_default_boolean(default):
    assert virtool.settings.get_default_boolean(default) == {
        "type": "boolean",
        "coerce": virtool.utils.to_bool,
        "default": default
    }


@pytest.mark.parametrize("default", [1, 3, 4, 5])
def test_get_default_integer(default):
    assert virtool.settings.get_default_integer(default) == {
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
        "build_index_proc": 2,
        "build_index_mem": 4
    }

    mocker.patch("virtool.resources.get", return_value=return_value)

    assert virtool.config.check_limits(proc, mem, settings) == error_message
