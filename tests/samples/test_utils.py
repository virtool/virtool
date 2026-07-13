from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.fake.next import DataFaker
from virtool.samples.utils import check_labels, encode_workflow_tags


async def test_check_labels(fake: DataFaker, spawn_client, pg: AsyncEngine):
    label_1 = await fake.labels.create()
    label_2 = await fake.labels.create()

    assert await check_labels(pg, [label_1.id, label_2.id]) == []
    assert await check_labels(pg, [label_2.id, 14]) == [14]
    assert await check_labels(pg, [22, 44]) == [22, 44]


class TestEncodeWorkflowTags:
    def test_no_analyses(self):
        """Absent workflows encode to ``none`` and falsey legacy tags."""
        assert encode_workflow_tags({}) == {
            "nuvs": False,
            "pathoscope": False,
            "workflows": {
                "nuvs": "none",
                "pathoscope": "none",
            },
        }

    def test_ready(self):
        """A ready analysis encodes to ``True`` and ``complete``."""
        assert encode_workflow_tags({"nuvs": True, "pathoscope": True}) == {
            "nuvs": True,
            "pathoscope": True,
            "workflows": {
                "nuvs": "complete",
                "pathoscope": "complete",
            },
        }

    def test_pending(self):
        """An unfinished analysis encodes to ``"ip"`` and ``pending``."""
        assert encode_workflow_tags({"nuvs": False, "pathoscope": False}) == {
            "nuvs": "ip",
            "pathoscope": "ip",
            "workflows": {
                "nuvs": "pending",
                "pathoscope": "pending",
            },
        }

    def test_mixed(self):
        """Each workflow encodes independently of the others."""
        assert encode_workflow_tags({"pathoscope": True}) == {
            "nuvs": False,
            "pathoscope": True,
            "workflows": {
                "nuvs": "none",
                "pathoscope": "complete",
            },
        }
