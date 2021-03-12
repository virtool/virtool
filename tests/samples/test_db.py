import filecmp
import gzip
import json
import os
import shutil
import sys
from pathlib import Path
from pprint import pprint
from unittest.mock import call

import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.samples.db
import virtool.samples.utils
import virtool.samples.db

FASTQ_PATH = Path(sys.path[0]) / "tests/test_files/test.fq"


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
        Test that the function returns the correct update dict for every combination of pathoscope and nuvs
        ready states.

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

        tags = virtool.samples.utils.calculate_workflow_tags(documents)

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

        await virtool.samples.db.recalculate_workflow_tags(dbi, "test")

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

        assert await virtool.samples.db.get_sample_owner(dbi, "test") == "foobar"

    async def test_none(self, dbi):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await virtool.samples.db.get_sample_owner(dbi, "foobar") is None


class TestRemoveSamples:

    @pytest.mark.parametrize("id_list,ls,samples,analyses", [
        (
            ["test_1"],
            ["test_2", "test_3"],
            [{"_id": "test_2"}, {"_id": "test_3"}],
            [
                {"_id": "a_3", "sample": {"id": "test_2"}},
                {"_id": "a_4", "sample": {"id": "test_2"}},
                {"_id": "a_5", "sample": {"id": "test_2"}},
                {"_id": "a_6", "sample": {"id": "test_3"}},
                {"_id": "a_7", "sample": {"id": "test_3"}},
                {"_id": "a_8", "sample": {"id": "test_3"}},
                {"_id": "a_9", "sample": {"id": "test_3"}}
            ]
        ),
        (
            ["test_1", "test_2"],
            ["test_3"],
            [{"_id": "test_3"}],
            [
                {"_id": "a_6", "sample": {"id": "test_3"}},
                {"_id": "a_7", "sample": {"id": "test_3"}},
                {"_id": "a_8", "sample": {"id": "test_3"}},
                {"_id": "a_9", "sample": {"id": "test_3"}}
            ]
        )
    ])
    async def test(self, id_list, ls, samples, analyses, tmpdir, dbi):
        """
        Test that the function can remove one or more samples, their analysis documents, and files.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")
        sample_2_file = samples_dir.mkdir("test_2").join("test.txt")
        sample_3_file = samples_dir.mkdir("test_3").join("test.txt")

        for handle in [sample_1_file, sample_2_file, sample_3_file]:
            handle.write("hello world")

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

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, id_list)

        assert set(ls) == set(os.listdir(str(samples_dir)))

        assert await dbi.samples.find().to_list(None) == samples
        assert await dbi.analyses.find().to_list(None) == analyses

    async def test_not_list(self, dbi):
        """
        Test that a custom ``TypeError`` is raised if a non-list variable is passed as ``id_list``.

        """
        settings = {
            "data_path"
        }

        with pytest.raises(TypeError) as excinfo:
            await virtool.samples.db.remove_samples(dbi, settings, "foobar")

        assert "id_list must be a list" in str(excinfo.value)

    async def test_file_not_found(self, tmpdir, dbi):
        """
        Test that the function does not fail when a sample folder is missing.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")

        sample_1_file.write("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, ["test_1", "test_2"])

        assert os.listdir(str(samples_dir)) == []

        assert not await dbi.samples.count_documents({})


class TestCheckIsLegacy:

    @pytest.mark.parametrize("is_legacy,files", [
        (False, [{"raw": True}]),
        (True, [{"raw": False}]),
        (False, [{"raw": True}, {"raw": False}]),
        (True, [{"raw": False}, {"raw": False}]),
    ])
    def test_raw(self, is_legacy, files):
        """


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

        assert virtool.samples.db.check_is_legacy(sample) is is_legacy

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

        assert virtool.samples.db.check_is_legacy(sample) is False


@pytest.mark.parametrize("paired", [True, False])
async def test_compress_reads(paired, dbi, snapshot, tmpdir):
    async def run_in_thread(func, *args):
        return func(*args)

    sample_dir = tmpdir.mkdir("samples").mkdir("foo")

    shutil.copy(FASTQ_PATH, sample_dir / "reads_1.fastq")

    if paired:
        shutil.copy(FASTQ_PATH, sample_dir / "reads_2.fastq")

    app_dict = {
        "db": dbi,
        "run_in_thread": run_in_thread,
        "settings": {
            "data_path": str(tmpdir)
        }
    }

    sample_id = "foo"

    file = {
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

    files = [file]

    if paired:
        files.append({
            **file,
            "name": "reads_2.fastq",
            "download_url": f"/download/samples/{sample_id}/reads_2.fastq"
        })

    sample = {
        "_id": sample_id,
        "files": files,
        "paired": paired
    }

    await dbi.samples.insert_one(sample)

    await virtool.samples.db.compress_reads(app_dict, sample)

    expected_listdir = ["reads_1.fq.gz", "reads_2.fq.gz"] if paired else ["reads_1.fq.gz"]

    assert sorted(os.listdir(sample_dir)) == expected_listdir

    with open(FASTQ_PATH, "r") as f:
        expected_content = f.read()

    with gzip.open(sample_dir / "reads_1.fq.gz", "rt") as f:
        assert expected_content == f.read()

    if paired:
        with gzip.open(sample_dir / "reads_2.fq.gz", "rt") as f:
            assert expected_content == f.read()

    snapshot.assert_match(await dbi.samples.find_one())


async def test_compress_reads_process(mocker, dbi):
    """
    Ensure `compress_reads` is called correctly given a samples collection.

    """
    app_dict = {
        "db": dbi,
        "run_in_thread": make_mocked_coro(),
        "settings": dict()
    }

    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "files": [
                {"raw": True},
                {"raw": False}
            ]
        },
        {
            "_id": "fab",
            "files": [
                {"raw": False}
            ]
        },
        {
            "_id": "bar",
            "files": [
                {"raw": True}
            ]
        },
        {
            "_id": "baz",
            "files": [
                {"raw": True},
                {"raw": True}
            ]
        },
        {
            "_id": "fob",
            "files": [
                {"raw": False},
                {"raw": False}
            ]
        }
    ])

    await dbi.processes.insert_one({
        "_id": "foo",
        "context": {
            "test": True
        }
    })

    m_compress_reads = mocker.patch("virtool.samples.db.compress_reads", make_mocked_coro())

    process = virtool.samples.db.CompressReadsProcess(app_dict, "foo")

    await process.run()

    assert len(m_compress_reads.mock_calls) == 3

    m_compress_reads.assert_has_calls([
        call(app_dict, {
            "_id": "foo",
            "files": [
                {"raw": True},
                {"raw": False}
            ]
        }),
        call(app_dict, {
            "_id": "fab",
            "files": [
                {"raw": False}
            ]
        }),
        call(app_dict, {
            "_id": "fob",
            "files": [
                {"raw": False},
                {"raw": False}
            ]
        })
    ])
