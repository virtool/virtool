import gzip
import os
import shutil
from asyncio import gather
from pathlib import Path
from types import SimpleNamespace

import pytest
import virtool.uploads.db
from aiohttp.test_utils import make_mocked_coro, make_mocked_request
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool.labels.models import Label
from virtool.pg.utils import get_row_by_id
from virtool.samples.db import (attach_labels, check_is_legacy,
                                compose_sample_workflow_query,
                                compress_sample_reads, create_sample, finalize,
                                get_sample_owner, recalculate_workflow_tags,
                                remove_samples, update_is_compressed)
from virtool.samples.models import SampleReads
from virtool.samples.utils import calculate_workflow_tags
from virtool.uploads.models import Upload

FASTQ_PATH = Path(__file__).parent.parent / "test_files/test.fq"


class TestCalculateWorkflowTags:

    @pytest.mark.parametrize("path_ready,path_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
    @pytest.mark.parametrize("alg1,alg2", [
        ("bowtie", "bowtie"),
        ("bowtie", "barracuda"),
        ("barracuda", "bowtie"),
        ("barracuda", "barracuda")
    ])
    @pytest.mark.parametrize("nuvs_ready,nuvs_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
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
                "workflow": "pathoscope_{}".format(alg1)
            },
            {
                "_id": index,
                "ready": path_ready_2,
                "workflow": "pathoscope_{}".format(alg2)
            },
            {
                "_id": index,
                "ready": nuvs_ready_1,
                "workflow": "nuvs"
            },
            {
                "_id": index,
                "ready": nuvs_ready_2,
                "workflow": "nuvs"
            }
        ]

        tags = calculate_workflow_tags(documents)

        assert tags == {
            "pathoscope": path_tag,
            "nuvs": nuvs_tag
        }


class TestRecalculateWorkflowTags:

    async def test(self, mocker, dbi):
        await dbi.samples.insert_one({
            "_id": "test",
            "pathoscope": False,
            "nuvs": False
        })

        analysis_documents = [
            {
                "_id": "test_1",
                "workflow": "pathoscope_bowtie",
                "ready": "ip",
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_2",
                "workflow": "pathoscope_bowtie",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_3",
                "workflow": "nuvs",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            }
        ]

        await dbi.analyses.insert_many(analysis_documents + [
            {
                "_id": "test_4",
                "sample": {
                    "id": "foobar"
                },
                "workflow": "pathoscope_bowtie",
                "ready": True
            }
        ])

        m = mocker.patch("virtool.samples.utils.calculate_workflow_tags", return_value={
            "pathoscope": True,
            "nuvs": "ip"
        })

        await recalculate_workflow_tags(dbi, "test")

        for document in analysis_documents:
            del document["sample"]

        assert m.call_args[0][0] == analysis_documents

        assert await dbi.samples.find_one() == {
            "_id": "test",
            "pathoscope": True,
            "nuvs": "ip"
        }


class TestGetSampleOwner:

    async def test(self, dbi):
        """
        Test that the correct owner id is returned given a sample id.

        """
        await dbi.samples.insert_many([
            {
                "_id": "test",
                "user": {
                    "id": "foobar"
                }
            },
            {
                "_id": "baz",
                "user": {
                    "id": "fred"
                }
            },
        ])

        assert await get_sample_owner(dbi, "test") == "foobar"

    async def test_none(self, dbi):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await get_sample_owner(dbi, "foobar") is None


class TestRemoveSamples:

    @pytest.mark.parametrize("id_list", [
        ["test_1"],
        ["test_1", "test_2"],
    ])
    async def test(self, id_list, snapshot, tmp_path, dbi, config):
        """
        Test that the function can remove one or more samples, their analysis documents, and files.

        """
        samples_dir = tmp_path / "samples"
        samples_dir.mkdir()

        paths = dict()

        for x in range(1, 4):
            paths[f"sample_{x}_file"] = samples_dir / f"test_{x}"
            paths[f"sample_{x}_file"].mkdir()

        for handle in paths.values():
            handle.joinpath("text.txt").write_text("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"},
            {"_id": "test_3"}
        ])

        await dbi.analyses.insert_many([
            {"_id": "a_1", "sample": {"id": "test_1"}},
            {"_id": "a_2", "sample": {"id": "test_1"}},
            {"_id": "a_3", "sample": {"id": "test_2"}},
            {"_id": "a_4", "sample": {"id": "test_2"}},
            {"_id": "a_5", "sample": {"id": "test_2"}},
            {"_id": "a_6", "sample": {"id": "test_3"}},
            {"_id": "a_7", "sample": {"id": "test_3"}},
            {"_id": "a_8", "sample": {"id": "test_3"}},
            {"_id": "a_9", "sample": {"id": "test_3"}}
        ])

        await remove_samples(dbi, config, id_list)

        assert set(os.listdir(samples_dir)) == snapshot
        assert await dbi.samples.find().to_list(None) == snapshot
        assert await dbi.analyses.find().to_list(None) == snapshot

    async def test_file_not_found(self, tmp_path, dbi, config):
        """
        Test that the function does not fail when a sample folder is missing.

        """
        samples_dir = tmp_path / "samples" / "test_1"
        samples_dir.mkdir(parents=True)

        samples_dir.joinpath("test.txt").write_text("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"}
        ])

        await remove_samples(dbi, config, ["test_1", "test_2"])

        assert not samples_dir.exists()
        assert not await dbi.samples.count_documents({})


async def test_attach_labels(snapshot, pg: AsyncEngine, pg_session):
    label_1 = Label(
        id=1,
        name="Bug",
        color="#a83432",
        description="This is a bug"
    )

    label_2 = Label(
        id=2,
        name="Question",
        color="#03fc20",
        description="This is a question"
    )

    async with pg_session as session:
        session.add_all([label_1, label_2])
        await session.commit()

    document = {
        "id": "foo",
        "name": "Foo",
        "labels": [1, 2]
    }

    assert await attach_labels(pg, document) == snapshot


async def test_create_sample(dbi, mocker, snapshot, static_time, spawn_client):
    """
    Test that a sample can be properly created.

    """
    client = await spawn_client(authorize=True, administrator=True)

    mocker.patch("virtool.db.utils.get_new_id", return_value="a2oj3gfd")

    result = await create_sample(
        dbi,
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
        settings=client.app["settings"]
    )

    assert result == snapshot
    assert await dbi.samples.find_one() == snapshot


class TestCheckIsLegacy:

    @pytest.mark.parametrize("is_legacy,files", [
        (False, [{"raw": True}]),
        (True, [{"raw": False}]),
        (False, [{"raw": True}, {"raw": False}]),
        (True, [{"raw": False}, {"raw": False}]),
    ])
    def test_raw(self, is_legacy, files):
        """
        Test that checks check ``raw`` files field correctly.

        """
        files[0]["name"] = "reads_1.fastq"

        try:
            files[1]["name"] = "reads_2.fastq"
        except IndexError:
            pass

        sample = {
            "_id": "foo",
            "paired": len(files) == 2,
            "files": files
        }

        assert check_is_legacy(sample) is is_legacy

    @pytest.mark.parametrize("paired", [True, False])
    def test_names(self, paired):
        """
        Test that checks fail when names are not as expected.

        """
        files = [{
            "name": "reads.fastq",
            "raw": False
        }]

        if paired:
            files.append({
                "name": "reads_two.fastq",
                "raw": False
            })

        sample = {
            "_id": "foo",
            "files": files,
            "paired": paired
        }

        assert check_is_legacy(sample) is False


async def test_update_is_compressed(snapshot, dbi):
    """
    Test that samples with both files gzipped are flagged with ``is_compressed``.

    """
    samples = [
        {
            "_id": "foo",
            "files": [
                {"name": "reads_1.fq.gz"},
                {"name": "reads_2.fq.gz"},
            ]
        },
        {
            "_id": "baz",
            "files": [
                {"name": "reads_1.fastq"}
            ]
        },
        {
            "_id": "bar",
            "files": [
                {"name": "reads_1.fq.gz"}
            ]
        }
    ]

    await dbi.samples.insert_many(samples)
    await gather(*[update_is_compressed(dbi, s) for s in samples])

    assert await dbi.samples.find().to_list(None) == snapshot


@pytest.mark.parametrize("paired", [True, False])
async def test_compress_sample_reads(paired, mocker, dbi, snapshot, tmp_path, config):
    m_update_is_compressed = mocker.patch(
        "virtool.samples.db.update_is_compressed",
        make_mocked_coro()
    )

    async def run_in_thread(func, *args):
        return func(*args)

    sample_dir = tmp_path / "samples" / "foo"
    sample_dir.mkdir(parents=True)

    shutil.copy(FASTQ_PATH, sample_dir / "reads_1.fastq")

    if paired:
        shutil.copy(FASTQ_PATH, sample_dir / "reads_2.fastq")

    app_dict = {
        "db": dbi,
        "run_in_thread": run_in_thread,
        "config": config
    }

    sample_id = "foo"

    reads_file = {
        "name": "reads_1.fastq",
        "download_url": f"/download/samples/{sample_id}/reads_1.fastq",
        "size": 3750821789,
        "raw": False,
        "from": {
            "id": "M_S11_R1_001.fastq",
            "name": "M_S11_R1_001.fastq",
            "size": 3750821789
        }
    }

    files = [reads_file]

    if paired:
        files.append({
            **reads_file,
            "name": "reads_2.fastq",
            "download_url": f"/download/samples/{sample_id}/reads_2.fastq"
        })

    sample = {
        "_id": sample_id,
        "files": files,
        "paired": paired
    }

    await dbi.samples.insert_one(sample)

    await compress_sample_reads(app_dict, sample)

    assert set(os.listdir(sample_dir)) == snapshot

    with open(FASTQ_PATH, "r") as f:
        expected_content = f.read()

    with gzip.open(sample_dir / "reads_1.fq.gz", "rt") as f:
        assert expected_content == f.read()

    if paired:
        with gzip.open(sample_dir / "reads_2.fq.gz", "rt") as f:
            assert expected_content == f.read()

    assert await dbi.samples.find_one() == snapshot

    m_update_is_compressed.assert_called_with(app_dict["db"], sample)


async def test_finalize(snapshot, tmp_path, dbi, pg: AsyncEngine, pg_session):
    quality = {
        "count": 10000000,
        "gc": 43
    }

    await dbi.samples.insert_one({
        "_id": "test",
    })

    async with pg_session as session:
        upload = Upload(
            name="test",
            name_on_disk="test.fq.gz"
        )

        reads = SampleReads(
            name="reads_1.fq.gz",
            name_on_disk="reads_1.fq.gz",
            sample="test"
        )

        upload.reads.append(reads)
        session.add_all([upload, reads])

        await session.commit()

    m_run_in_thread = make_mocked_coro()

    result = await finalize(
        dbi,
        pg,
        "test",
        quality,
        m_run_in_thread,
        tmp_path
    )

    assert result == snapshot

    assert result == {
        "_id": "test",
        "quality": {
            "count": 10000000,
            "gc": 43
        },
        "ready": True,
        "artifacts": [],
        "reads": [
            {
                "download_url": '/api/samples/test/reads/reads_1.fq.gz',
                "id": 1,
                "sample": "test",
                "name": "reads_1.fq.gz",
                "name_on_disk": "reads_1.fq.gz",
                "size": None,
                "upload": None,
                "uploaded_at": None
            }
        ]
    }

    assert not await virtool.uploads.db.get(pg, 1)
    assert not (await get_row_by_id(pg, SampleReads, 1)).upload


class TestComposeWorkflowQuery:

    @pytest.mark.parametrize("url", [
        "/api/samples?workflows=pathoscope%3Aready foo%3Apending foo%3Anone",
        "/api/samples?workflows=pathoscope%3Aready foo%3Apending&workflows=foo%3Anone"
    ], ids=["single", "multiple"])
    def test(self, url):
        """
        Test that the workflow query is composed from a single `workflows` parameter as well as
        two.

        """
        req = make_mocked_request("GET", url)

        result = compose_sample_workflow_query(req.query)\

        assert len(result) == 2
        assert result["pathoscope"]["$in"] == [True]
        assert set(result["foo"]["$in"]) == {False, "ip"}

    def test_empty(self):
        """
        Check that `None` is returned when there is no `workflows` parameter.

        """
        req = make_mocked_request(
            "GET",
            "/api/samples?find=foo"
        )

        assert compose_sample_workflow_query(req.query) is None

    def test_some_conditions_invalid(self):
        """
        Check that an invalid condition doesn't make it into the query.

        """
        req = make_mocked_request(
            "GET",
            "/api/samples?workflows=pathoscope%3Abar pathoscope%3Aready"
        )

        assert compose_sample_workflow_query(req.query) == {
            "pathoscope": {
                "$in": [True]
            }
        }

    def test_all_conditions_invalid(self):
        """
        Check that if no valid conditions are found, `None` is returned.

        """
        req = make_mocked_request(
            "GET",
            "/api/samples?workflows=pathoscope%3Abar"
        )

        assert compose_sample_workflow_query(req.query) is None
