import gzip
import os
import shutil
from asyncio import gather
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro, make_mocked_request
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.transforms import apply_transforms
from virtool.data.utils import get_data_from_app
from virtool.labels.db import AttachLabelsTransform
from virtool.samples.db import (
    check_is_legacy,
    compose_sample_workflow_query,
    compress_sample_reads,
    create_sample,
    get_sample_owner,
    recalculate_workflow_tags,
    update_is_compressed,
)
from virtool.samples.db import define_initial_workflows, derive_workflow_state
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
        """
        Test that the function returns the correct update dict for every combination of pathoscope
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


class TestRecalculateWorkflowTags:
    async def test(self, mocker, mongo):
        await mongo.samples.insert_one(
            {"_id": "test", "pathoscope": False, "nuvs": False}
        )

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
                }
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
                "nuvs": "complete",
                "pathoscope": "complete",
            },
        }


class TestDeriveWorkflowStates:
    @pytest.mark.parametrize("library_type", ["amplicon", "normal", "srna", "other"])
    def test_define_initial_workflows(self, library_type, snapshot):
        """
        Test that initial workflow states are correctly defined.
        """
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
        self, workflow_name, analysis_states, final_workflow_state
    ):
        """
        Test that workflows are set to complete and pending as expected.
        """
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
            }
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

        final_workflow_states = derive_workflow_state(documents, library_type)

        expected_final_workflow_state = {
            "workflows": {
                "aodp": final_workflow_state,
                "nuvs": "incompatible",
                "pathoscope": "incompatible",
            }
        }

        assert final_workflow_states == expected_final_workflow_state


class TestGetSampleOwner:
    async def test(self, mongo):
        """
        Test that the correct owner id is returned given a sample id.

        """
        await mongo.samples.insert_many(
            [
                {"_id": "test", "user": {"id": "foobar"}},
                {"_id": "baz", "user": {"id": "fred"}},
            ],
            session=None,
        )

        assert await get_sample_owner(mongo, "test") == "foobar"

    async def test_none(self, mongo):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await get_sample_owner(mongo, "foobar") is None


async def test_attach_labels(fake2, snapshot, pg: AsyncEngine):
    label_1 = await fake2.labels.create()
    label_2 = await fake2.labels.create()

    document = {"id": "foo", "name": "Foo", "labels": [label_1.id, label_2.id]}

    assert await apply_transforms(document, [AttachLabelsTransform(pg)]) == snapshot


async def test_create_sample(mongo, mocker, snapshot, static_time, spawn_client):
    """
    Test that a sample can be properly created.

    """
    client = await spawn_client(authorize=True, administrator=True)

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


class TestCheckIsLegacy:
    @pytest.mark.parametrize(
        "is_legacy,files",
        [
            (False, [{"raw": True}]),
            (True, [{"raw": False}]),
            (False, [{"raw": True}, {"raw": False}]),
            (True, [{"raw": False}, {"raw": False}]),
        ],
    )
    def test_raw(self, is_legacy, files):
        """
        Test that checks check ``raw`` files field correctly.

        """
        files[0]["name"] = "reads_1.fastq"

        try:
            files[1]["name"] = "reads_2.fastq"
        except IndexError:
            pass

        sample = {"_id": "foo", "paired": len(files) == 2, "files": files}

        assert check_is_legacy(sample) is is_legacy

    @pytest.mark.parametrize("paired", [True, False])
    def test_names(self, paired):
        """
        Test that checks fail when names are not as expected.

        """
        files = [{"name": "reads.fastq", "raw": False}]

        if paired:
            files.append({"name": "reads_two.fastq", "raw": False})

        sample = {"_id": "foo", "files": files, "paired": paired}

        assert check_is_legacy(sample) is False


async def test_update_is_compressed(snapshot, mongo):
    """
    Test that samples with both files gzipped are flagged with ``is_compressed``.

    """
    samples = [
        {
            "_id": "foo",
            "files": [
                {"name": "reads_1.fq.gz"},
                {"name": "reads_2.fq.gz"},
            ],
        },
        {"_id": "baz", "files": [{"name": "reads_1.fastq"}]},
        {"_id": "bar", "files": [{"name": "reads_1.fq.gz"}]},
    ]

    await mongo.samples.insert_many(samples, session=None)
    await gather(*[update_is_compressed(mongo, s) for s in samples])

    assert await mongo.samples.find().to_list(None) == snapshot


@pytest.mark.parametrize("paired", [True, False])
async def test_compress_sample_reads(paired, mocker, mongo, snapshot, tmp_path, config):
    m_update_is_compressed = mocker.patch(
        "virtool.samples.db.update_is_compressed", make_mocked_coro()
    )

    sample_dir = tmp_path / "samples" / "foo"
    sample_dir.mkdir(parents=True)

    shutil.copy(FASTQ_PATH, sample_dir / "reads_1.fastq")

    if paired:
        shutil.copy(FASTQ_PATH, sample_dir / "reads_2.fastq")

    app_dict = {"db": mongo, "config": config}

    sample_id = "foo"

    reads_file = {
        "name": "reads_1.fastq",
        "download_url": f"/download/samples/{sample_id}/reads_1.fastq",
        "size": 3750821789,
        "raw": False,
        "from": {
            "id": "M_S11_R1_001.fastq",
            "name": "M_S11_R1_001.fastq",
            "size": 3750821789,
        },
    }

    files = [reads_file]

    if paired:
        files.append(
            {
                **reads_file,
                "name": "reads_2.fastq",
                "download_url": f"/download/samples/{sample_id}/reads_2.fastq",
            }
        )

    sample = {"_id": sample_id, "files": files, "paired": paired}

    await mongo.samples.insert_one(sample)

    await compress_sample_reads(mongo, config, sample)

    assert set(os.listdir(sample_dir)) == snapshot

    with open(FASTQ_PATH, "r") as f:
        expected_content = f.read()

    with gzip.open(sample_dir / "reads_1.fq.gz", "rt") as f:
        assert expected_content == f.read()

    if paired:
        with gzip.open(sample_dir / "reads_2.fq.gz", "rt") as f:
            assert expected_content == f.read()

    assert await mongo.samples.find_one() == snapshot

    m_update_is_compressed.assert_called_with(app_dict["db"], sample)


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
        """
        Test that the workflow query is composed of a single `workflows` parameter as well as
        two.

        """
        result = compose_sample_workflow_query(workflows)

        assert len(result) == 2
        assert result["pathoscope"]["$in"] == [True]
        assert set(result["foo"]["$in"]) == {False, "ip"}

    def test_empty(self):
        """
        Check that `None` is returned when there is no `workflows` parameter.

        """
        req = make_mocked_request("GET", "/samples?find=foo")

        assert compose_sample_workflow_query(req.query) is None

    def test_some_conditions_invalid(self):
        """
        Check that an invalid condition doesn't make it into the query.

        """
        assert compose_sample_workflow_query(
            ["pathoscope:bar", "pathoscope:ready"]
        ) == {"pathoscope": {"$in": [True]}}

    def test_all_conditions_invalid(self):
        """
        Check that if no valid conditions are found, `None` is returned.

        """
        assert compose_sample_workflow_query(["pathoscope:bar"]) is None
