import pytest
from aiohttp.test_utils import make_mocked_request
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.analyses.sql import SQLAnalysis
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.samples.db import (
    compose_sample_workflow_query,
    create_sample,
    define_initial_workflows,
    derive_workflow_state,
    get_sample_owner,
    recalculate_workflow_tags,
)
from virtool.samples.utils import calculate_workflow_tags
from virtool.utils import timestamp
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestCalculateWorkflowTags:
    @pytest.mark.parametrize(
        ("path_ready", "path_tag"),
        [
            ([False, False], "ip"),
            ([True, False], True),
            ([False, True], True),
            ([True, True], True),
        ],
    )
    @pytest.mark.parametrize(
        ("nuvs_ready", "nuvs_tag"),
        [
            ([False, False], "ip"),
            ([True, False], True),
            ([False, True], True),
            ([True, True], True),
        ],
    )
    def test(self, path_ready, path_tag, nuvs_ready, nuvs_tag):
        """Test that the function returns the correct update dict for every
        combination of pathoscope and nuvs ready states.
        """
        index = 0

        path_ready_1, path_ready_2 = path_ready
        nuvs_ready_1, nuvs_ready_2 = nuvs_ready

        documents = [
            {"_id": index, "ready": path_ready_1, "workflow": "pathoscope"},
            {"_id": index, "ready": path_ready_2, "workflow": "pathoscope"},
            {"_id": index, "ready": nuvs_ready_1, "workflow": "nuvs"},
            {"_id": index, "ready": nuvs_ready_2, "workflow": "nuvs"},
        ]

        tags = calculate_workflow_tags(documents)

        assert tags == {"pathoscope": path_tag, "nuvs": nuvs_tag}


async def test_recalculate_workflow_tags(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
):
    user = await fake.users.create()

    await mongo.samples.insert_one({"_id": "test", "pathoscope": False, "nuvs": False})

    def make_row(legacy_id: str, sample: str, workflow: str, *, ready: bool):
        return SQLAnalysis(
            legacy_id=legacy_id,
            created_at=timestamp(),
            updated_at=timestamp(),
            workflow=workflow,
            ready=ready,
            sample=sample,
            reference="ref",
            index="index",
            user_id=user.id,
        )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                make_row("test_1", "test", "pathoscope", ready=False),
                make_row("test_2", "test", "pathoscope", ready=True),
                make_row("test_3", "test", "nuvs", ready=True),
                # Belongs to another sample and must be excluded.
                make_row("test_4", "foobar", "pathoscope", ready=True),
            ],
        )
        await session.commit()

    m = mocker.patch(
        "virtool.samples.utils.calculate_workflow_tags",
        return_value={"pathoscope": True, "nuvs": "ip"},
    )

    await recalculate_workflow_tags(mongo, pg, "test")

    expected = [
        {"workflow": "pathoscope", "ready": False},
        {"workflow": "pathoscope", "ready": True},
        {"workflow": "nuvs", "ready": True},
    ]

    def key(analysis: dict) -> tuple:
        return analysis["workflow"], analysis["ready"]

    assert sorted(m.call_args[0][0], key=key) == sorted(expected, key=key)

    assert await mongo.samples.find_one() == {
        "_id": "test",
        "pathoscope": True,
        "nuvs": "ip",
        "workflows": {
            "aodp": "incompatible",
            "nuvs": "complete",
            "pathoscope": "complete",
        },
    }


class TestDeriveWorkflowStates:
    @pytest.mark.parametrize("library_type", ["amplicon", "normal", "srna", "other"])
    def test_define_initial_workflows(self, library_type, snapshot):
        """Test that initial workflow states are correctly defined."""
        workflow_states = define_initial_workflows(library_type=library_type)
        assert workflow_states == snapshot

    @pytest.mark.parametrize("workflow_name", ["nuvs", "pathoscope"])
    @pytest.mark.parametrize(
        ("analysis_states", "final_workflow_state"),
        [
            ((False, False), "pending"),
            ((True, False), "complete"),
            ((False, True), "complete"),
            ((True, True), "complete"),
        ],
    )
    def test_derive_workflow_states(
        self,
        workflow_name: str,
        analysis_states: tuple[bool, bool],
        final_workflow_state: str,
    ):
        """Test that workflows are set to complete and pending as expected."""
        index = 0
        library_type = "other"
        ready_1, ready_2 = analysis_states

        documents = [
            {"_id": index, "ready": ready_1, "workflow": workflow_name},
            {"_id": index, "ready": ready_2, "workflow": workflow_name},
        ]

        final_workflow_states = derive_workflow_state(documents, library_type)

        expected_workflow_states = {
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "none",
                "pathoscope": "none",
            },
        }

        expected_workflow_states["workflows"][workflow_name] = final_workflow_state

        assert final_workflow_states == expected_workflow_states

    @pytest.mark.parametrize(
        ("analysis_states", "final_workflow_state"),
        [
            ([False, False], "pending"),
            ([True, False], "complete"),
            ([False, True], "complete"),
            ([True, True], "complete"),
        ],
    )
    def test_derive_aodp_workflow_states(self, analysis_states, final_workflow_state):
        index = 0
        library_type = "amplicon"
        ready_1, ready_2 = analysis_states

        documents = [
            {"_id": index, "ready": ready_1, "workflow": "aodp"},
            {"_id": index, "ready": ready_2, "workflow": "aodp"},
        ]

        assert derive_workflow_state(documents, library_type) == {
            "workflows": {
                "aodp": final_workflow_state,
                "nuvs": "incompatible",
                "pathoscope": "incompatible",
            },
        }


class TestGetSampleOwner:
    async def test(self, mongo):
        """Test that the correct owner id is returned given a sample id."""
        await mongo.samples.insert_many(
            [
                {"_id": "test", "user": {"id": "foobar"}},
                {"_id": "baz", "user": {"id": "fred"}},
            ],
            session=None,
        )

        assert await get_sample_owner(mongo, "test") == "foobar"

    async def test_none(self, mongo):
        """Test that ``None`` is returned if the sample id does not exist."""
        assert await get_sample_owner(mongo, "foobar") is None


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


class TestComposeWorkflowQuery:
    @pytest.mark.parametrize(
        "workflows",
        [
            ["pathoscope:ready", "foo:pending", "foo:none"],
            ["pathoscope:ready", " foo:pending", "foo:none"],
        ],
        ids=["single", "multiple"],
    )
    def test(self, workflows):
        """Test that the workflow query is composed of a single `workflows` parameter as well as
        two.

        """
        result = compose_sample_workflow_query(workflows)

        assert len(result) == 2
        assert result["pathoscope"]["$in"] == [True]
        assert set(result["foo"]["$in"]) == {False, "ip"}

    def test_empty(self):
        """Check that `None` is returned when there is no `workflows` parameter."""
        req = make_mocked_request("GET", "/samples?find=foo")

        assert compose_sample_workflow_query(req.query) is None

    def test_some_conditions_invalid(self):
        """Check that an invalid condition doesn't make it into the query."""
        assert compose_sample_workflow_query(
            ["pathoscope:bar", "pathoscope:ready"],
        ) == {"pathoscope": {"$in": [True]}}

    def test_all_conditions_invalid(self):
        """Check that if no valid conditions are found, `None` is returned."""
        assert compose_sample_workflow_query(["pathoscope:bar"]) is None
