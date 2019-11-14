import os
import sys
import json
import shutil
import pytest

import virtool.jobs.pathoscope

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
PATHOSCOPE_PATH = os.path.join(TEST_FILES_PATH, "pathoscope")

BEST_HIT_PATH = os.path.join(PATHOSCOPE_PATH, "best_hit")
RESULTS_PATH = os.path.join(PATHOSCOPE_PATH, "results.json")
EM_PATH = os.path.join(PATHOSCOPE_PATH, "em")
ISOLATES_VTA_PATH = os.path.join(PATHOSCOPE_PATH, "to_isolates.vta")
MATRIX_PATH = os.path.join(PATHOSCOPE_PATH, "ps_matrix")
REF_LENGTHS_PATH = os.path.join(PATHOSCOPE_PATH, "ref_lengths.json")
SAM_PATH = os.path.join(PATHOSCOPE_PATH, "test_al.sam")
SCORES = os.path.join(PATHOSCOPE_PATH, "scores")
TO_SUBTRACTION_PATH = os.path.join(PATHOSCOPE_PATH, "to_subtraction.json")
TSV_PATH = os.path.join(PATHOSCOPE_PATH, "report.tsv")
UNU_PATH = os.path.join(PATHOSCOPE_PATH, "unu")
UPDATED_VTA_PATH = os.path.join(PATHOSCOPE_PATH, "updated.vta")
VTA_PATH = os.path.join(PATHOSCOPE_PATH, "test.vta")

INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")


@pytest.fixture(scope="session")
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
def mock_job(tmpdir, mocker, request, dbs, test_db_connection_string, test_db_name, otu_resource):
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

    sequence_otu_map, _ = otu_resource

    dbs.jobs.insert_one({
        "_id": "foobar",
        "task": "pathoscope_bowtie",
        "args": {
            "sample_id": "foobar",
            "analysis_id": "baz",
            "ref_id": "original",
            "index_id": "index3"
        },
        "proc": 2,
        "mem": 8
    })

    dbs.indexes.insert_one({
        "_id": "index3",
        "manifest": {
            "foobar": 10,
            "reo": 5,
            "baz": 6
        },
        "sequence_otu_map": sequence_otu_map
    })

    queue = mocker.Mock()

    job = virtool.jobs.pathoscope.Job(
        test_db_connection_string,
        test_db_name,
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

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")

    assert mock_job.params["read_count"] == 1337

    expected_read_filenames = ["reads_1.fastq"]

    if paired:
        expected_read_filenames.append("reads_2.fastq")

    assert mock_job.params["subtraction_path"] == os.path.join(
        str(tmpdir),
        "subtractions",
        "arabidopsis_thaliana",
        "reference"
    )


def test_make_analysis_dir(dbs, mock_job):
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

    assert not os.path.isdir(mock_job.params["analysis_path"])

    mock_job.make_analysis_dir()

    assert os.path.isdir(mock_job.params["analysis_path"])


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

    os.makedirs(mock_job.params["analysis_path"])

    mock_job.params["read_paths"] = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    mock_job.map_default_isolates()

    assert sorted(mock_job.intermediate["to_otus"]) == sorted([
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
    ])


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

    os.makedirs(mock_job.params["analysis_path"])

    mock_job.params["read_paths"] = [
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

    vta_path = os.path.join(mock_job.params["analysis_path"], "to_isolates.vta")

    with open(vta_path, "r") as f:
        observed = sorted([line.rstrip() for line in f])

    with open(ISOLATES_VTA_PATH, "r") as f:
        expected = sorted([line.rstrip() for line in f])

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
    mock_job.params["subtraction_path"] = HOST_PATH

    os.makedirs(mock_job.params["analysis_path"])

    shutil.copyfile(FASTQ_PATH, os.path.join(mock_job.params["analysis_path"], "mapped.fastq"))

    mock_job.map_subtraction()

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        assert sorted(mock_job.intermediate["to_subtraction"]) == sorted(json.load(handle))


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

    os.makedirs(mock_job.params["analysis_path"])

    with open(TO_SUBTRACTION_PATH, "r") as handle:
        mock_job.intermediate["to_subtraction"] = json.load(handle)

    shutil.copyfile(VTA_PATH, os.path.join(mock_job.params["analysis_path"], "to_isolates.vta"))

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

    os.makedirs(mock_job.params["analysis_path"])

    with open(REF_LENGTHS_PATH, "r") as handle:
        mock_job.intermediate["ref_lengths"] = json.load(handle)

    shutil.copyfile(
        VTA_PATH,
        os.path.join(mock_job.params["analysis_path"], "to_isolates.vta")
    )

    mock_job.params["sequence_otu_map"] = {
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

    mock_job.pathoscope()

    # Check that a new VTA is written.
    with open(UPDATED_VTA_PATH, "r") as f:
        updated_vta = sorted([line.rstrip() for line in f])

    with open(os.path.join(mock_job.params["analysis_path"], "reassigned.vta"), "r") as f:
        assert updated_vta == sorted([line.rstrip() for line in f])

    # Check that the correct report.tsv file is written.
    with open(TSV_PATH, "r") as f:
        updated_tsv = sorted([line.rstrip() for line in f])

    with open(os.path.join(mock_job.params["analysis_path"], "report.tsv"), "r") as f:
        assert updated_tsv == sorted([line.rstrip() for line in f])

    with open(RESULTS_PATH, "r") as handle:
        expected = sorted(json.load(handle), key=lambda h: h["id"])
        results = mock_job.results

        assert results["read_count"] == 20276
        assert results["ready"] is True

        assert expected == sorted(results["results"], key=lambda h: h["id"])


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
        "results": "results will be here",
        "read_count": 1337,
        "ready": True
    }

    mock_job.import_results()

    assert dbs.analyses.find_one() == {
        "_id": "baz",
        "ready": True,
        "algorithm": "pathoscope_bowtie",
        "results": "results will be here",
        "read_count": 1337,
        "sample": {
            "id": "foobar"
        }
    }

    assert dbs.samples.find_one() == {
        "_id": "foobar",
        "nuvs": False,
        "pathoscope": True,
        "subtraction": {
            "id": "Arabidopsis thaliana"
        },
        "quality": {
            "count": 1337
        },
        "paired": False
    }
