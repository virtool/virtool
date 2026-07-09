import pytest

from virtool.samples.db import compose_sample_workflow_filter


class TestComposeSampleWorkflowFilter:
    @pytest.mark.parametrize(
        "workflows",
        [
            ["pathoscope:ready"],
            ["pathoscope:ready", "nuvs:pending", "nuvs:none"],
            ["pathoscope:bar", "pathoscope:ready"],
        ],
        ids=["single", "multiple", "some_invalid"],
    )
    def test_valid(self, workflows: list[str]):
        """A parseable query yields a predicate."""
        assert compose_sample_workflow_filter(workflows) is not None

    def test_empty(self):
        """An empty query yields no predicate."""
        assert compose_sample_workflow_filter([]) is None

    def test_all_conditions_invalid(self):
        """A query with only invalid conditions yields no predicate."""
        assert compose_sample_workflow_filter(["pathoscope:bar"]) is None

    def test_unknown_workflow_dropped(self):
        """An unknown workflow name yields no predicate rather than a NOT EXISTS.

        A ``none`` condition on a bogus workflow would otherwise match nearly every
        sample; it must be ignored like any other unrecognised filter.
        """
        assert compose_sample_workflow_filter(["nuuvs:none"]) is None
        assert (
            compose_sample_workflow_filter(["nuuvs:none", "pathoscope:ready"])
            is not None
        )
