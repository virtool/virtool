from datetime import datetime

import pytest

from virtool.analyses.checks import (
    check_if_analysis_modified,
    check_if_analysis_ready,
    check_analysis_workflow,
    check_if_analysis_running,
    check_analysis_nuvs_sequence,
)
from virtool.data.errors import (
    ResourceNotModifiedError,
    ResourceConflictError,
    ResourceNotFoundError,
)


@pytest.mark.parametrize("error", [True, False])
async def test_check_if_analysis_modified(error, static_time):
    analysis = {"id": "baz", "created_at": static_time}
    if_modified_since = static_time

    if error:
        with pytest.raises(ResourceNotModifiedError):
            await check_if_analysis_modified(if_modified_since, analysis)
        return

    if_modified_since = datetime(2016, 12, 25, 8, 0, 0)
    assert await check_if_analysis_modified(if_modified_since, analysis) is None


@pytest.mark.parametrize("error", [True, False])
async def test_check_if_analysis_ready(error):

    jobs_api_flag = True
    ready = True

    if error:
        with pytest.raises(ResourceConflictError):
            await check_if_analysis_ready(jobs_api_flag, ready)
        return

    jobs_api_flag = False
    assert await check_if_analysis_ready(jobs_api_flag, ready) is None


@pytest.mark.parametrize("error", [True, False])
async def test_check_analysis_workflow(error):

    workflow = "pathoscope"

    if error:
        with pytest.raises(ResourceConflictError) as err:
            await check_analysis_workflow(workflow)
        assert "Not a NuVs analysis" in str(err)
        return

    workflow = "nuvs"
    assert await check_analysis_workflow(workflow) is None


@pytest.mark.parametrize("error", [True, False])
async def test_check_if_analysis_running(error):

    ready = False

    if error:
        with pytest.raises(ResourceConflictError) as err:
            await check_if_analysis_running(ready)
        assert "Analysis is still running" in str(err)
        return

    ready = True
    assert await check_if_analysis_running(ready) is None


@pytest.mark.parametrize("error", [True, False])
async def test_check_analysis_nuvs_sequence(error):

    document = {
        "results": {
            "hits": [
                {"index": 0, "sequence": "TGATTGTCGTCCAATGGCTAGAAA"},
                {"index": 1, "sequence": "CAAATAGATTTAAACCCATTTATA"},
            ]
        }
    }

    sequence_index = 2

    if error:
        with pytest.raises(ResourceNotFoundError) as err:
            await check_analysis_nuvs_sequence(document, sequence_index)

    sequence_index = 1
    assert await check_analysis_nuvs_sequence(document, sequence_index) is None
