from pyfixtures import FixtureScope
from syrupy import SnapshotSession

from virtool.workflow.data.ml import WFMLModelRelease
from virtool.workflow.pytest_plugin.data import WorkflowData

test = SnapshotSession


class TestML:
    """Tests for the ML fixture that provides ML models for analyses."""

    async def test_ok(
        self,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that the ML fixture instantiates, contains the expected data, and
        downloads the sample files to the work path.
        """
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

        workflow_data.analysis.workflow = "iimi"
        workflow_data.analysis.ml = workflow_data.ml

        ml: WFMLModelRelease = await scope.instantiate_by_key("ml")

        assert ml.id == workflow_data.ml.id
        assert ml.name == workflow_data.ml.name

        assert ml.path.is_dir()
        assert sorted([p.name for p in ml.path.iterdir()]) == [
            "mappability_profile.rds",
            "model.tar.gz",
            "nucleotide_info.csv",
            "reference.json.gz",
            "trained_rf.rds",
            "trained_xgb.rds",
            "virus_segments.rds",
        ]

    async def test_none(
        self,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that the ML fixture returns None when no ML model is specified."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

        workflow_data.analysis.ml = None
        workflow_data.analysis.workflow = "nuvs"

        ml: WFMLModelRelease = await scope.instantiate_by_key("ml")

        assert ml is None
