import json
import os
import shutil
import sys

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
UNU_PATH = os.path.join(PATHOSCOPE_PATH, "unu")
VTA_PATH = os.path.join(PATHOSCOPE_PATH, "test.vta")
INDEXES_PATH = os.path.join(TEST_FILES_PATH, "index")
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
async def mock_job(tmpdir, dbi, test_db_connection_string, test_db_name, otu_resource):
    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name
    }

    sequence_otu_map, _ = otu_resource

    await dbi.analyses.insert_one({
        "_id": "baz",
        "workflow": "pathoscope_bowtie",
        "ready": False,
        "sample": {
            "id": "foobar"
        },
        "subtraction": {
            "id": "Prunus persica"
        }
    })

    await dbi.jobs.insert_one({
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

    await dbi.indexes.insert_one({
        "_id": "index3",
        "manifest": {
            "foobar": 10,
            "reo": 5,
            "baz": 6
        },
        "sequence_otu_map": sequence_otu_map
    })

    await dbi.samples.insert_one({
        "_id": "foobar",
        "paired": False,
        "library_type": "normal",
        "quality": {
            "count": 1337,
            "length": [78, 101]
        },
        "subtraction": {
            "id": "Arabidopsis thaliana"
        }
    })

    job = virtool.jobs.pathoscope.create()

    job.db = dbi
    job.id = "foobar"
    job.mem = 4
    job.proc = 1
    job.settings = settings

    job.params = {
        "analysis_id": "baz",
        "analysis_path": os.path.join(str(tmpdir), "samples", "foobar", "analysis", "baz"),
        "index_path": os.path.join(INDEXES_PATH, "reference"),
        "manifest": {
            "foobar": 10,
            "reo": 5,
            "baz": 6
        },
        "read_paths": [
            os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
        ],
        "sample_id": "foobar",
        "sample_path": os.path.join(str(tmpdir), "samples", "foobar"),
        "subtraction_path": HOST_PATH,
        "temp_analysis_path": os.path.join(str(tmpdir), "temp", "temp_analysis")
    }

    os.makedirs(job.params["temp_analysis_path"])

    return job


async def test_map_default_isolates(tmpdir, mock_job):
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    await virtool.jobs.pathoscope.map_default_isolates(mock_job)

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


async def test_map_isolates(snapshot, tmpdir, dbs, mock_job):
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")

    for filename in os.listdir(INDEXES_PATH):
        if "reference" in filename:
            shutil.copyfile(
                os.path.join(INDEXES_PATH, filename),
                os.path.join(mock_job.params["temp_analysis_path"], filename.replace("reference", "isolates"))
            )

    mock_job.proc = 2

    await virtool.jobs.pathoscope.map_isolates(mock_job)

    vta_path = os.path.join(mock_job.params["temp_analysis_path"], "to_isolates.vta")

    with open(vta_path, "r") as f:
        data = sorted([line.rstrip() for line in f])
        snapshot.assert_match(data, "isolates")


async def test_map_subtraction(snapshot, dbs, mock_job):
    mock_job.proc = 2
    mock_job.params["subtraction_path"] = HOST_PATH

    shutil.copyfile(FASTQ_PATH, os.path.join(mock_job.params["temp_analysis_path"], "mapped.fastq"))

    await virtool.jobs.pathoscope.map_subtraction(mock_job)

    sorted_lines = sorted(mock_job.intermediate["to_subtraction"])

    snapshot.assert_match(sorted_lines, "subtraction")


async def test_subtract_mapping(dbs, mock_job):
    with open(TO_SUBTRACTION_PATH, "r") as handle:
        mock_job.intermediate["to_subtraction"] = json.load(handle)

    shutil.copyfile(VTA_PATH, os.path.join(mock_job.params["temp_analysis_path"], "to_isolates.vta"))

    await virtool.jobs.pathoscope.subtract_mapping(mock_job)

    assert mock_job.results["subtracted_count"] == 4


async def test_pathoscope(snapshot, mock_job):
    with open(REF_LENGTHS_PATH, "r") as handle:
        mock_job.intermediate["ref_lengths"] = json.load(handle)

    shutil.copyfile(
        VTA_PATH,
        os.path.join(mock_job.params["temp_analysis_path"], "to_isolates.vta")
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

    await virtool.jobs.pathoscope.pathoscope(mock_job)

    with open(os.path.join(mock_job.params["temp_analysis_path"], "reassigned.vta"), "r") as f:
        data = sorted([line.rstrip() for line in f])
        snapshot.assert_match(data)

    with open(os.path.join(mock_job.params["temp_analysis_path"], "report.tsv"), "r") as f:
        data = sorted([line.rstrip() for line in f])
        snapshot.assert_match(data)

    snapshot.assert_match(mock_job.results)


async def test_import_results(snapshot, dbi, mock_job):
    mock_job.results = {
        "results": "results will be here",
        "read_count": 1337,
        "ready": True
    }

    await virtool.jobs.pathoscope.import_results(mock_job)

    snapshot.assert_match(await dbi.analyses.find_one())
    snapshot.assert_match(await dbi.samples.find_one())
