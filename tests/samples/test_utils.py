import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.fake.next import DataFaker
from virtool.samples.utils import (
    check_labels,
    define_initial_workflows,
    encode_workflow_tags,
)


async def test_check_labels(fake: DataFaker, spawn_client, pg: AsyncEngine):
    label_1 = await fake.labels.create()
    label_2 = await fake.labels.create()

    assert await check_labels(pg, [label_1.id, label_2.id]) == []
    assert await check_labels(pg, [label_2.id, 14]) == [14]
    assert await check_labels(pg, [22, 44]) == [22, 44]


class TestDefineInitialWorkflows:
    def test_amplicon(self):
        assert define_initial_workflows("amplicon") == {
            "aodp": "none",
            "nuvs": "incompatible",
            "pathoscope": "incompatible",
        }

    @pytest.mark.parametrize("library_type", ["normal", "srna", "other"])
    def test_non_amplicon(self, library_type: str):
        assert define_initial_workflows(library_type) == {
            "aodp": "incompatible",
            "nuvs": "none",
            "pathoscope": "none",
        }


class TestEncodeWorkflowTags:
    def test_no_analyses(self):
        """Absent workflows encode to the initial states and falsey legacy tags."""
        assert encode_workflow_tags({}, "normal") == {
            "nuvs": False,
            "pathoscope": False,
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "none",
                "pathoscope": "none",
            },
        }

    def test_ready(self):
        """A ready analysis encodes to ``True`` and ``complete``."""
        assert encode_workflow_tags(
            {"nuvs": True, "pathoscope": True},
            "normal",
        ) == {
            "nuvs": True,
            "pathoscope": True,
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "complete",
                "pathoscope": "complete",
            },
        }

    def test_pending(self):
        """An unfinished analysis encodes to ``"ip"`` and ``pending``."""
        assert encode_workflow_tags(
            {"nuvs": False, "pathoscope": False},
            "normal",
        ) == {
            "nuvs": "ip",
            "pathoscope": "ip",
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "pending",
                "pathoscope": "pending",
            },
        }

    def test_aodp(self):
        """An amplicon sample derives its aodp state and leaves the rest incompatible."""
        assert encode_workflow_tags({"aodp": True}, "amplicon") == {
            "nuvs": False,
            "pathoscope": False,
            "workflows": {
                "aodp": "complete",
                "nuvs": "incompatible",
                "pathoscope": "incompatible",
            },
        }
