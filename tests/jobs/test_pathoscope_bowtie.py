import os
import sys
import json
import shutil
import pytest
import filecmp

import virtool.jobs.job
import virtool.jobs.analysis

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")

INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
VTA_PATH = os.path.join(TEST_FILES_PATH, "test.vta")
UPDATED_VTA_PATH = os.path.join(TEST_FILES_PATH, "updated.vta")
ISOLATES_VTA_PATH = os.path.join(TEST_FILES_PATH, "pathoscope_bowtie/to_isolates.vta")
TSV_PATH = os.path.join(TEST_FILES_PATH, "report.tsv")
REF_LENGTHS_PATH = os.path.join(TEST_FILES_PATH, "ref_lengths.json")
COVERAGE_PATH = os.path.join(TEST_FILES_PATH, "coverage.json")
DIAGNOSIS_PATH = os.path.join(TEST_FILES_PATH, "diagnosis.json")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")
TO_SUBTRACTION_PATH = os.path.join(TEST_FILES_PATH, "to_subtraction.json")


@pytest.fixture("session")
def otu_resource():
    map_dict = dict()
    otus = dict()

    with open(VTA_PATH, "r") as handle:
        for line in handle:
            ref_id = line.split(",")[1]

            otu_id = "otu_{}".format(ref_id)

            map_dict[ref_id] = otu_id

            otus[otu_id] = {
                "otu": otu_id,
                "version": 2
            }

    return map_dict, otus


@pytest.fixture
def mock_job(loop, tmpdir, mocker, dbs, test_db_name, otu_resource):
    # Add index files.
    shutil.copytree(INDEX_PATH, os.path.join(str(tmpdir), "references", "original", "index3"))

    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    # Copy read files.
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name
    }

    sequence_otu_map, otu_dict = otu_resource

    dbs.jobs.insert_one({
        "_id": "foobar",
        "task": "pathoscope_bowtie",
        "args": {
            "sample_id": "foobar",
            "analysis_id": "baz",
            "ref_id": "original",
            "index_id": "index3",
            "sequence_otu_map": sequence_otu_map,
            "otu_dict": otu_dict
        },
        "proc": 2,
        "mem": 8
    })

    queue = mocker.Mock()

    job = virtool.jobs.analysis.PathoscopeBowtie(
        "mongodb://localhost:27017",
        settings,
        "foobar",
        queue
    )

    job.init_db()

    return job


@pytest.mark.parametrize("paired", [False, True])
def test_check_db(tmpdir, paired, dbs, mock_job):
    """
    Check that the method assigns various job attributes based on information from the database.

    """
    assert mock_job.sample is None
    assert mock_job.read_paths is None
    assert mock_job.subtraction is None

    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": paired,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    dbs.subtraction.insert_one({
        "_id": "Arabidopsis thaliana"
    })

    mock_job.check_db()

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
        "subtractions",
        "arabidopsis_thaliana",
        "reference"
    )


def test_mk_analysis_dir(dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    assert not os.path.isdir(mock_job.analysis_path)

    mock_job.mk_analysis_dir()

    assert os.path.isdir(mock_job.analysis_path)


def test_map_otus(tmpdir, dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    os.makedirs(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    mock_job.map_otus()

    assert mock_job.intermediate["to_otus"] == {
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


def test_map_isolates(tmpdir, dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    os.makedirs(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")
    index_path = os.path.join(str(tmpdir), "references", "original", "index3")

    for filename in os.listdir(index_path):
        shutil.copyfile(
            os.path.join(index_path, filename),
            os.path.join(sample_path, "analysis", "baz", filename.replace("reference", "isolates"))
        )

    mock_job.proc = 2

    mock_job.map_isolates()

    vta_path = os.path.join(mock_job.analysis_path, "to_isolates.vta")

    with open(vta_path, "r") as f:
        observed = {line.rstrip() for line in f}

    with open(ISOLATES_VTA_PATH, "r") as f:
        expected = {line.rstrip() for line in f}

    assert observed == expected


def test_map_subtraction(dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    mock_job.proc = 2
    mock_job.subtraction_path = HOST_PATH

    os.makedirs(mock_job.analysis_path)

    shutil.copyfile(FASTQ_PATH, os.path.join(mock_job.analysis_path, "mapped.fastq"))

    mock_job.map_subtraction()

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        assert mock_job.intermediate["to_subtraction"] == json.load(handle)


def test_subtract_mapping(dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    os.makedirs(mock_job.analysis_path)

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        mock_job.intermediate["to_subtraction"] = json.load(handle)

    shutil.copyfile(VTA_PATH, os.path.join(mock_job.analysis_path, "to_isolates.vta"))

    mock_job.subtract_mapping()

    assert mock_job.results["subtracted_count"] == 4


def test_pathoscope(dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    os.makedirs(mock_job.analysis_path)

    with open(REF_LENGTHS_PATH, "r") as handle:
        mock_job.intermediate["ref_lengths"] = json.load(handle)

    shutil.copyfile(
        VTA_PATH,
        os.path.join(mock_job.analysis_path, "to_isolates.vta")
    )

    mock_job.sequence_otu_map = {
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

    mock_job.otu_dict = {
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

    mock_job.pathoscope()

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


def test_import_results(dbs, mock_job):
    dbs.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        }
    })

    mock_job.check_db()

    dbs.analyses.insert_one({
        "_id": "baz",
        "algorithm": "pathoscope_bowtie",
        "ready": False,
        "sample": {
            "id": "foobar"
        }
    })

    mock_job.results = {
        "diagnosis": "diagnosis will be here",
        "read_count": 1337,
        "ready": True
    }

    mock_job.import_results()

    assert dbs.analyses.find_one() == {
        "_id": "baz",
        "ready": True,
        "algorithm": "pathoscope_bowtie",
        "diagnosis": "diagnosis will be here",
        "read_count": 1337,
        "sample": {
            "id": "foobar"
        }
    }

    assert dbs.samples.find_one() == {
        "_id": "foobar",
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        },
        "paired": False
    }
