import pytest
from pytest_mock import MockerFixture
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.data.utils import get_data_from_app
from virtool.mongo.core import Mongo
from virtool.samples.db import compose_sample_workflow_filter, create_sample
from virtool.workflow.pytest_plugin.utils import StaticTime


async def test_create_sample(
    mongo: Mongo,
    mocker: MockerFixture,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    """Test that a sample can be properly created."""
    client = await spawn_client(administrator=True)

    mocker.patch("virtool.mongo.utils.get_new_id", return_value="a2oj3gfd")

    settings = await get_data_from_app(client.app).settings.get_all()

    result = await create_sample(
        mongo,
        "foo",
        "",
        "",
        "",
        "",
        "",
        [],
        "test",
        [],
        "bob",
        settings=settings,
    )

    assert result == snapshot
    assert await mongo.samples.find_one() == snapshot


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
