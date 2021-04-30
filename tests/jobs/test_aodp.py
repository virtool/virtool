import os
import filecmp
import sys
import shutil
import pytest
import io
import virtool.jobs.aodp

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
TEST_REF_PATH = os.path.join(TEST_FILES_PATH, "aodp", "reference.fa")


@pytest.fixture
async def mock_job(tmp_path, monkeypatch, dbi, test_db_connection_string, test_db_name):
    monkeypatch.setattr('sys.stdin', io.StringIO('my input'))

    index_dir = tmp_path / "references" / "foo_ref" / "foo_index"
    index_dir.mkdir(parents=True)
    shutil.copy(TEST_REF_PATH, index_dir / "ref.fa")

    (tmp_path / "samples" / "foo_sample" / "analysis" / "foo_analysis").mkdir(parents=True)

    settings = {
        "data_path": tmp_path,
        "db_name": test_db_name
    }

    await dbi.analyses.insert_one({
        "_id": "foo_analysis",
        "workflow": "aodp",
        "ready": False,
        "sample": {
            "id": "foobar"
        },
        "subtraction": {
            "id": "Prunus persica"
        }
    })

    await dbi.indexes.insert_one({
        "_id": "foo_index",
        "manifest": {
            "foo": 1,
            "bar": 5
        },
        "sequence_otu_map": {
            "foo": "bar"
        }
    })

    await dbi.samples.insert_one({
        "_id": "foo_sample",
        "library_type": "amplicon",
        "paired": False,
        "quality": {
            "count": 10000,
            "length": [78, 101]
        },
        "subtraction": {
            "id": "foo_subtraction"
        }
    })

    await dbi.references.insert_one({
        "_id": "foo_ref",
        "data_type": "barcode"
    })

    await dbi.jobs.insert_one({
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

    config = {
        **settings,
        "db_connection_string": test_db_connection_string,
        "db_name": test_db_name,
        "proc": 1,
        "mem": 4
    }

    job = virtool.jobs.aodp.create()

    job.db = dbi
    job.settings = config
    job.id = "foo_job"

    await job._connect_db()
    await job._startup()

    return job


async def test_fetch_index(mock_job):
    await virtool.jobs.aodp.prepare_index(mock_job)

    assert filecmp.cmp(
        TEST_REF_PATH,
        mock_job.params["temp_index_path"],
    )
