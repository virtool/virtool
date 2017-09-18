import os
import sys
import json
import shutil
import pytest
import filecmp
from concurrent.futures import ProcessPoolExecutor

import virtool.job
import virtool.sample_analysis

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")

INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
VTA_PATH = os.path.join(TEST_FILES_PATH, "test.vta")
UPDATED_VTA_PATH = os.path.join(TEST_FILES_PATH, "updated.vta")
TSV_PATH = os.path.join(TEST_FILES_PATH, "report.tsv")
REF_LENGTHS_PATH = os.path.join(TEST_FILES_PATH, "ref_lengths.json")
COVERAGE_PATH = os.path.join(TEST_FILES_PATH, "coverage.json")
DIAGNOSIS_PATH = os.path.join(TEST_FILES_PATH, "diagnosis.json")


@pytest.fixture("session")
def virus_resource():
    map_dict = dict()
    viruses = dict()

    with open(VTA_PATH, "r") as handle:
        for line in handle:
            ref_id = line.split(",")[1]

            virus_id = "virus_{}".format(ref_id)

            map_dict[ref_id] = virus_id

            viruses[virus_id] = {
                "id": virus_id,
                "version": 2
            }

    return map_dict, viruses


@pytest.fixture
async def mock_job(tmpdir, loop, test_motor, test_dispatch, virus_resource):
    # Add index files.
    shutil.copytree(INDEX_PATH, os.path.join(str(tmpdir), "reference", "viruses", "index"))

    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    # Copy read files.
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    executor = ProcessPoolExecutor()

    settings = {
        "data_path": str(tmpdir)
    }

    sequence_virus_map, virus_dict = virus_resource

    task_args = {
        "sample_id": "foobar",
        "analysis_id": "baz",
        "index_id": "index",
        "sequence_virus_map": sequence_virus_map,
        "virus_dict": virus_dict
    }

    job = virtool.sample_analysis.PathoscopeBowtie(
        loop,
        executor,
        test_motor,
        settings,
        test_dispatch,
        "foobar",
        "pathoscope_bowtie",
        task_args,
        1,
        4
    )

    return job


@pytest.mark.parametrize("paired", [False, True])
async def test_check_db(tmpdir, paired, test_motor, mock_job):
    """
    Check that the method assigns various job attributes based on information from the database.

    """
    assert mock_job.sample is None
    assert mock_job.read_paths is None
    assert mock_job.host is None

    await test_motor.samples.insert_one({
        "_id": "foobar",
        "paired": paired,
        "subtraction": "Arabidopsis thaliana",
        "quality": {
            "count": 1337
        }
    })

    await test_motor.hosts.insert_one({
        "_id": "Arabidopsis thaliana"
    })

    await mock_job.check_db()

    assert mock_job.sample == {
        "_id": "foobar",
        "paired": paired,
        "subtraction": "Arabidopsis thaliana",
        "quality": {
            "count": 1337
        }
    }

    assert mock_job.host == {
        "_id": "Arabidopsis thaliana"
    }

    assert mock_job.read_count == 1337

    expected_read_filenames = ["reads_1.fastq"]

    if paired:
        expected_read_filenames.append("reads_2.fastq")

    assert mock_job.read_paths == [os.path.join(mock_job.sample_path, filename) for filename in expected_read_filenames]

    assert mock_job.host_path == os.path.join(str(tmpdir), "reference", "hosts", "arabidopsis_thaliana", "reference")


async def test_mk_analysis_dir(mock_job):
    assert not os.path.isdir(mock_job.analysis_path)

    await mock_job.mk_analysis_dir()

    assert os.path.isdir(mock_job.analysis_path)


async def test_map_viruses(tmpdir, mock_job):
    os.makedirs(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    await mock_job.map_viruses()

    assert mock_job.intermediate["to_viruses"] == {
        "NC_013110",
        "NC_017938",
        "NC_006057",
        "NC_007448",
        "JQ080272",
        "NC_001836",
        "NC_003347",
        "NC_016509",
        "NC_017939",
        "NC_006056",
        "NC_003623",
        "KX109927",
        "NC_016416",
        "NC_001948",
        "NC_021148",
        "NC_003615",
        "NC_004006"
    }


async def test_map_isolates(tmpdir, mock_job):
    os.makedirs(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")
    index_path = os.path.join(str(tmpdir), "reference", "viruses", "index")

    for filename in os.listdir(index_path):
        shutil.copyfile(
            os.path.join(index_path, filename),
            os.path.join(sample_path, "analysis", "baz", filename.replace("reference", "isolates"))
        )

    mock_job.proc = 2

    await mock_job.map_isolates()

    vta_path = os.path.join(mock_job.analysis_path, "to_isolates.vta")
    assert os.path.getsize(vta_path) == 50090


async def test_pathoscope(mock_job):
    os.makedirs(mock_job.analysis_path)

    with open(REF_LENGTHS_PATH, "r") as handle:
        mock_job.intermediate["ref_lengths"] = json.load(handle)

    shutil.copyfile(
        VTA_PATH,
        os.path.join(mock_job.analysis_path, "to_isolates.vta")
    )

    await mock_job.pathoscope()

    # Check that a new VTA is written.
    assert filecmp.cmp(
        os.path.join(mock_job.analysis_path, "reassigned.vta"),
        UPDATED_VTA_PATH
    )

    # Check that the correct report.tsv file is written.
    assert filecmp.cmp(
        os.path.join(mock_job.analysis_path, "report.tsv"),
        TSV_PATH
    )

    with open(DIAGNOSIS_PATH, "r") as handle:
        assert mock_job.results == {
            "diagnosis": json.load(handle),
            "read_count": 20276,
            "ready": True
        }


async def test_import_results(test_motor, test_dispatch, mock_job):
    await test_motor.analyses.insert_one({
        "_id": "baz",
        "algorithm": "pathoscope_bowtie",
        "ready": False,
        "sample": {
            "id": "foobar"
        }
    })

    await test_motor.samples.insert_one({
        "_id": "foobar",
        "pathoscope": False
    })

    mock_job.results = {
        "diagnosis": "diagnosis will be here",
        "read_count": 1337,
        "ready": True
    }

    await mock_job.import_results()

    assert await test_motor.analyses.find_one() == {
        "_id": "baz",
        "ready": True,
        "algorithm": "pathoscope_bowtie",
        "diagnosis": "diagnosis will be here",
        "read_count": 1337,
        "sample": {
            "id": "foobar"
        }
    }

    assert await test_motor.samples.find_one() == {
        "_id": "foobar",
        "nuvs": False,
        "pathoscope": True
    }

    assert test_dispatch.stub.call_args[0] == (
        "samples",
        "update",
        {
            "_id": "foobar",
            "nuvs": False,
            "pathoscope": True
        }
    )
