import os
import filecmp
import sys
import shutil
import pytest
import virtool.jobs.aodp

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
TEST_REF_PATH = os.path.join(TEST_FILES_PATH, "aodp", "reference.fa")


@pytest.fixture
def mock_job(tmpdir, mocker, request, dbs, test_db_connection_string, test_db_name):
    index_dir = tmpdir.mkdir("references").mkdir("foo_ref").mkdir("foo_index")
    shutil.copy(TEST_REF_PATH, str(index_dir))

    tmpdir.mkdir("samples").mkdir("foo_sample").mkdir("analysis").mkdir("foo_analysis")

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name
    }

    dbs.indexes.insert_one({
        "_id": "foo_index",
        "manifest": {
            "foo": 1,
            "bar": 5
        },
        "sequence_otu_map": {
            "foo": "bar"
        }
    })

    dbs.samples.insert_one({
        "_id": "foo_sample",
        "library_type": "amplicon",
        "paired": False,
        "quality": {
            "count": 10000
        },
        "subtraction": {
            "id": "foo_subtraction"
        }
    })

    dbs.references.insert_one({
        "_id": "foo_ref",
        "data_type": "barcode"
    })

    dbs.jobs.insert_one({
        "_id": "foo_job",
        "task": "aodp",
        "args": {
            "analysis_id": "foo_analysis",
            "index_id": "foo_index",
            "ref_id": "foo_ref",
            "sample_id": "foo_sample"
        },
        "proc": 2,
        "mem": 8
    })

    queue = mocker.Mock()

    job = virtool.jobs.aodp.Job(
        test_db_connection_string,
        test_db_name,
        settings,
        "foo_job",
        queue
    )

    job.init_db()

    return job


def test_fetch_index(mock_job):
    mock_job.check_db()
    mock_job.prepare_index()

    assert filecmp.cmp(
        TEST_REF_PATH,
        mock_job.params["index_path"] + ".fa",
    )


def test_aodp(mock_job):
    mock_job.check_db()
    mock_job.proc = 1

    mock_job.aodp()







