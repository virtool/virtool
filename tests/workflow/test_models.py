import pytest
from pydantic import ValidationError

from virtool.jobs.models import Workflow
from virtool.workflow.models import WorkflowCacheParams


class TestWorkflowCacheParams:
    @pytest.mark.parametrize(
        "version",
        ["0.2.2", "1.0.0-alpha", "2.3.4+build.5", "v1.2.3"],
    )
    def test_accepts_valid_semver(self, version):
        params = WorkflowCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version=version,
        )
        assert params.workflow_version == version

    @pytest.mark.parametrize(
        "version",
        ["", "1", "1.2", "not-a-version", "1.2.3.4"],
    )
    def test_rejects_invalid_version(self, version):
        with pytest.raises(ValidationError, match="workflow_version"):
            WorkflowCacheParams(
                workflow_name=Workflow.CREATE_SAMPLE,
                workflow_version=version,
            )

    def test_rejects_unknown_workflow_name(self):
        with pytest.raises(ValidationError, match="workflow_name"):
            WorkflowCacheParams(
                workflow_name="not_a_real_workflow",
                workflow_version="1.0.0",
            )

    def test_serializes_workflow_name_as_string(self):
        """The cache key digest must see a plain string, not an enum member."""
        params = WorkflowCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version="1.0.0",
        )
        assert params.dict()["workflow_name"] == "create_sample"
