from datetime import datetime

import pytest

from virtool.analyses.checks import (
    check_if_analysis_modified,
    check_if_analysis_ready,
)
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotModifiedError,
)


@pytest.fixture
def analysis(static_time):
    return {
        "id": "baz",
        "created_at": static_time,
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
