import os

import aiohttp.test_utils
import pytest

import virtool.jobs.create_sample


@pytest.fixture
async def mock_job(mocker, tmpdir, loop, request, dbi, test_db_connection_string, test_db_name):
    tmpdir.mkdir("samples")
    tmpdir.mkdir("logs").mkdir("jobs")

    settings = {
        "data_path": str(tmpdir),
        "db_connection_string": test_db_connection_string,
        "db_name": test_db_name,
        "proc": 1,
        "mem": 4
    }

    await dbi.jobs.insert_one({
        "_id": "foobar",
        "task": "create_sample",
        "args": {
            "sample_id": "baz",
            "files": [
                {
                    "id": "foo.fq.gz"
                }
            ]
        }
    })

    await dbi.samples.insert_one({
        "_id": "baz",
        "paired": False,
        "files": [{
            "id": "foo.fq.gz",
            "size": 123456
        }]
    })

    job = virtool.jobs.create_sample.create()

    job.db = dbi
    job.id = "foobar"
    job.settings = settings
    job.task_name = "create_sample"

    await job._connect_db()

    return job


async def test_check_db(mocker, snapshot, mock_job):
    await virtool.jobs.create_sample.check_db(mock_job)

    data_path = mock_job.settings["data_path"]
    temp_sample_path = os.path.join(mock_job.temp_dir.name, "baz")

    assert mock_job.params == {
        "document": {
            "_id": "baz",
            "paired": False,
            "files": [{
                "id": "foo.fq.gz",
                "size": 123456
            }]
        },
        "fastqc_path": os.path.join(temp_sample_path, "fastqc"),
        "files": [{
            "id": "foo.fq.gz",
            "size": 123456
        }],
        "paired": False,
        "sample_id": "baz",
        "sample_path": os.path.join(data_path, "samples", "baz"),
        "temp_sample_path": temp_sample_path

    }


@pytest.mark.parametrize("exists", [None, "sample", "fastqc", "analysis"])
def test_make_sample_dir(exists, tmpdir, mock_job):
    """
    Test that the function makes the specified sample tree even if the sample path and/or the analysis path already
    exist.

    """
    sample_path = os.path.join(tmpdir, "foo")

    test_make_sample_dir.params = {
        "sample_path": sample_path,
        "analysis_path": os.path.join(sample_path, "analysis"),
        "fastqc_path": os.path.join(sample_path, "fastqc")
    }

    if exists is not None:
        os.makedirs(test_make_sample_dir.params[f"{exists}_path"])
