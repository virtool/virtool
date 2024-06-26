from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_request

from virtool.data.utils import get_data_from_app
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

FASTQ_PATH = Path(__file__).parent.parent / "test_files/test.fq"


class TestCalculateWorkflowTags:
    @pytest.mark.parametrize(
        "path_ready,path_tag",
        [
            ([False, False], "ip"),
            ([True, False], True),
            ([False, True], True),
            ([True, True], True),
        ],
    )
    @pytest.mark.parametrize(
        "alg1,alg2",
        [
            ("bowtie", "bowtie"),
            ("bowtie", "barracuda"),
            ("barracuda", "bowtie"),
            ("barracuda", "barracuda"),
        ],
    )
    @pytest.mark.parametrize(
        "nuvs_ready,nuvs_tag",
        [
            ([False, False], "ip"),
            ([True, False], True),
            ([False, True], True),
            ([True, True], True),
        ],
    )
    def test(self, path_ready, alg1, alg2, path_tag, nuvs_ready, nuvs_tag):
        """Test that the function returns the correct update dict for every combination of pathoscope
        and nuvs ready states.

        """
        index = 0

        path_ready_1, path_ready_2 = path_ready
        nuvs_ready_1, nuvs_ready_2 = nuvs_ready

        documents = [
            {
                "_id": index,
                "ready": path_ready_1,
                "workflow": f"pathoscope_{alg1}",
            },
            {"_id": index, "ready": path_ready_2, "workflow": f"pathoscope_{alg2}"},
            {"_id": index, "ready": nuvs_ready_1, "workflow": "nuvs"},
            {"_id": index, "ready": nuvs_ready_2, "workflow": "nuvs"},
        ]

        tags = calculate_workflow_tags(documents)

        assert tags == {"pathoscope": path_tag, "nuvs": nuvs_tag}


async def test_recalculate_workflow_tags(mocker, mongo: Mongo):
    await mongo.samples.insert_one({"_id": "test", "pathoscope": False, "nuvs": False})

    analysis_documents = [
        {
            "_id": "test_1",
            "workflow": "pathoscope_bowtie",
            "ready": "ip",
            "sample": {"id": "test"},
        },
        {
            "_id": "test_2",
            "workflow": "pathoscope_bowtie",
            "ready": True,
            "sample": {"id": "test"},
        },
        {
            "_id": "test_3",
            "workflow": "nuvs",
            "ready": True,
            "sample": {"id": "test"},
        },
    ]

    await mongo.analyses.insert_many(
        analysis_documents
        + [
            {
                "_id": "test_4",
                "sample": {"id": "foobar"},
                "workflow": "pathoscope_bowtie",
                "ready": True,
            },
        ],
        session=None,
    )

    m = mocker.patch(
        "virtool.samples.utils.calculate_workflow_tags",
        return_value={"pathoscope": True, "nuvs": "ip"},
    )

    await recalculate_workflow_tags(mongo, "test")

    for document in analysis_documents:
        del document["sample"]

    assert m.call_args[0][0] == analysis_documents

    assert await mongo.samples.find_one() == {
        "_id": "test",
        "pathoscope": True,
        "nuvs": "ip",
        "workflows": {
            "aodp": "incompatible",
            "iimi": "none",
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
        "analysis_states, final_workflow_state",
        [
            ([False, False], "pending"),
            ([True, False], "complete"),
            ([False, True], "complete"),
            ([True, True], "complete"),
        ],
    )
    def test_derive_workflow_states(
        self,
        workflow_name,
        analysis_states,
        final_workflow_state,
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
                "iimi": "none",
                "nuvs": "none",
                "pathoscope": "none",
            },
        }

        expected_workflow_states["workflows"][workflow_name] = final_workflow_state

        assert final_workflow_states == expected_workflow_states

    @pytest.mark.parametrize(
        "analysis_states, final_workflow_state",
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
                "iimi": "incompatible",
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


async def test_create_sample(mongo, mocker, snapshot, static_time, spawn_client):
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
