import os
import sys
import json
import shutil
import pytest
import filecmp
from concurrent.futures import ProcessPoolExecutor

import virtool.jobs.job
import virtool.jobs.analysis

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")

INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
VTA_PATH = os.path.join(TEST_FILES_PATH, "test.vta")
UPDATED_VTA_PATH = os.path.join(TEST_FILES_PATH, "updated.vta")
TSV_PATH = os.path.join(TEST_FILES_PATH, "report.tsv")
REF_LENGTHS_PATH = os.path.join(TEST_FILES_PATH, "ref_lengths.json")
COVERAGE_PATH = os.path.join(TEST_FILES_PATH, "coverage.json")
DIAGNOSIS_PATH = os.path.join(TEST_FILES_PATH, "diagnosis.json")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")
TO_SUBTRACTION_PATH = os.path.join(TEST_FILES_PATH, "to_subtraction.json")


@pytest.fixture("session")
def species_resource():
    map_dict = dict()
    species = dict()

    with open(VTA_PATH, "r") as handle:
        for line in handle:
            ref_id = line.split(",")[1]

            species_id = "species_{}".format(ref_id)

            map_dict[ref_id] = species_id

            species[species_id] = {
                "species": species_id,
                "version": 2
            }

    return map_dict, species


@pytest.fixture
async def mock_job(loop, mocker, tmpdir, test_motor, test_dispatch, species_resource):
    # Add index files.
    shutil.copytree(INDEX_PATH, os.path.join(str(tmpdir), "reference", "species", "index"))

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

    sequence_species_map, species_dict = species_resource

    task_args = {
        "sample_id": "foobar",
        "analysis_id": "baz",
        "index_id": "index",
        "sequence_species_map": sequence_species_map,
        "species_dict": species_dict
    }

    job = virtool.jobs.analysis.PathoscopeBowtie(
        loop,
        executor,
        test_motor,
        settings,
        test_dispatch,
        mocker.stub("capture_exception"),
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
    assert mock_job.subtraction is None

    await test_motor.samples.insert_one({
        "_id": "foobar",
        "paired": paired,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    await test_motor.subtraction.insert_one({
        "_id": "Arabidopsis thaliana"
    })

    await mock_job.check_db()

    assert mock_job.sample == {
        "_id": "foobar",
        "paired": paired,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    }

    assert mock_job.subtraction == {
        "_id": "Arabidopsis thaliana"
    }

    assert mock_job.read_count == 1337

    expected_read_filenames = ["reads_1.fastq"]

    if paired:
        expected_read_filenames.append("reads_2.fastq")

    assert mock_job.read_paths == [os.path.join(mock_job.sample_path, filename) for filename in expected_read_filenames]

    assert mock_job.subtraction_path == os.path.join(
        str(tmpdir),
        "reference",
        "subtraction",
        "arabidopsis_thaliana",
        "reference"
    )


async def test_mk_analysis_dir(mock_job):
    assert not os.path.isdir(mock_job.analysis_path)

    await mock_job.mk_analysis_dir()

    assert os.path.isdir(mock_job.analysis_path)


async def test_map_species(tmpdir, mock_job):
    os.makedirs(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    await mock_job.map_species()

    assert mock_job.intermediate["to_species"] == {
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
    index_path = os.path.join(str(tmpdir), "reference", "species", "index")

    for filename in os.listdir(index_path):
        shutil.copyfile(
            os.path.join(index_path, filename),
            os.path.join(sample_path, "analysis", "baz", filename.replace("reference", "isolates"))
        )

    mock_job.proc = 2

    await mock_job.map_isolates()

    vta_path = os.path.join(mock_job.analysis_path, "to_isolates.vta")
    assert os.path.getsize(vta_path) == 50090


async def test_map_subtraction(mock_job):
    mock_job.proc = 2
    mock_job.subtraction_path = HOST_PATH

    os.makedirs(mock_job.analysis_path)

    shutil.copyfile(FASTQ_PATH, os.path.join(mock_job.analysis_path, "mapped.fastq"))

    await mock_job.map_subtraction()

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        assert mock_job.intermediate["to_subtraction"] == json.load(handle)


async def test_subtract_mapping(mock_job):
    os.makedirs(mock_job.analysis_path)

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        mock_job.intermediate["to_subtraction"] = json.load(handle)

    shutil.copyfile(VTA_PATH, os.path.join(mock_job.analysis_path, "to_isolates.vta"))

    await mock_job.subtract_mapping()

    assert mock_job.results["subtracted_count"] == 4


async def test_pathoscope(mock_job):
    os.makedirs(mock_job.analysis_path)

    with open(REF_LENGTHS_PATH, "r") as handle:
        mock_job.intermediate["ref_lengths"] = json.load(handle)

    shutil.copyfile(
        VTA_PATH,
        os.path.join(mock_job.analysis_path, "to_isolates.vta")
    )

    with open(DIAGNOSIS_PATH, "r") as handle:
        report_dict = json.load(handle)

    mock_job.sequence_species_map = {
        "NC_016509": "foobar",
        "NC_001948": "foobar",
        "13TF149_Reovirus_TF1_Seg06": "reo",
        "13TF149_Reovirus_TF1_Seg03": "reo",
        "13TF149_Reovirus_TF1_Seg07": "reo",
        "13TF149_Reovirus_TF1_Seg02": "reo",
        "13TF149_Reovirus_TF1_Seg08": "reo",
        "13TF149_Reovirus_TF1_Seg11": "reo",
        "13TF149_Reovirus_TF1_Seg04": "reo",
        "NC_004667": "foobar",
        "NC_003347": "foobar",
        "NC_003615": "foobar",
        "NC_003689": "foobar",
        "NC_011552": "foobar",
        "KX109927": "baz",
        "NC_008039": "foobar",
        "NC_015782": "foobar",
        "NC_016416": "foobar",
        "NC_003623": "foobar",
        "NC_008038": "foobar",
        "NC_001836": "foobar",
        "JQ080272": "baz",
        "NC_017938": "foobar",
        "NC_008037": "foobar",
        "NC_007448": "foobar"
    }

    mock_job.species_dict = {
        "foobar": {
            "name": "Foobar",
            "version": 10
        },
        "reo": {
            "name": "Reovirus",
            "version": 5
        },
        "baz": {
            "name": "Bazvirus",
            "version": 6
        }
    }

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
