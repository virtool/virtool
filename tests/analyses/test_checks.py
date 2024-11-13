from datetime import datetime

import pytest

from virtool.analyses.checks import (
    check_analysis_nuvs_sequence,
    check_if_analysis_is_nuvs,
    check_if_analysis_modified,
    check_if_analysis_not_ready,
    check_if_analysis_ready,
)
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceNotModifiedError,
)


@pytest.fixture()
def analysis(static_time):
    return {
        "id": "baz",
        "created_at": static_time,
        "results": {
            "hits": [
                {"index": 0, "sequence": "TGATTGTCGTCCAATGGCTAGAAA"},
                {"index": 1, "sequence": "CAAATAGATTTAAACCCATTTATA"},
            ],
        },
    }


class TestCheckAnalysisModified:
    async def test_ok(self, analysis):
        if_modified_since = datetime(2016, 12, 25, 8, 0, 0)
        assert await check_if_analysis_modified(if_modified_since, analysis) is None

    async def test_error(self, analysis):
        if_modified_since = analysis["created_at"]
        with pytest.raises(ResourceNotModifiedError):
            await check_if_analysis_modified(if_modified_since, analysis)


class TestCheckAnalysisReady:
    async def test_ok(self):
        assert await check_if_analysis_ready(False, True) is None

    async def test_error(self):
        with pytest.raises(ResourceConflictError):
            await check_if_analysis_ready(True, True)


class TestCheckIfAnalysisIsNuvs:
    async def test_ok(self):
        """Test that the function doesn't raise and exception when the workflow is
        'nuvs'.
        """
        assert await check_if_analysis_is_nuvs("nuvs") is None

    async def test_error(self):
        """Test that the function raises an exception when the workflow is not
        'nuvs'.
        """
        with pytest.raises(ResourceConflictError) as err:
            await check_if_analysis_is_nuvs("pathoscope")

        assert "Not a NuVs analysis" in str(err)


class TestCheckAnalysisRunning:
    """Tests for the check_if_analysis_running function."""

    async def test_ok(self):
        """Test that the function doesn't raise an exception when the analysis is
        not running.
        """
        assert await check_if_analysis_not_ready(True) is None

    async def test_error(self):
        """Test that the function raises an exception when the analysis is still
        running.
        """
        with pytest.raises(ResourceConflictError) as err:
            await check_if_analysis_not_ready(False)

        assert "Analysis is still running" in str(err)


class TestCheckNUVsSequence:
    async def test_ok(self, analysis):
        assert await check_analysis_nuvs_sequence(analysis, 1) is None

    async def test_error(self, analysis):
        with pytest.raises(ResourceNotFoundError):
            await check_analysis_nuvs_sequence(analysis, 2)
