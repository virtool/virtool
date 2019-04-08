import os
import pytest

import virtool.jobs.create_sample


@pytest.fixture
def test_create_sample_job(mocker, tmpdir, loop, request, dbi, dbs, test_db_connection_string, test_db_name):
    tmpdir.mkdir("samples")
    tmpdir.mkdir("logs").mkdir("jobs")

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name,
        "create_sample_proc": 6
    }

    q = mocker.Mock()

    job = virtool.jobs.create_sample.Job(
        test_db_connection_string,
        test_db_name,
        settings,
        "foobar",
        q
    )

    dbs.jobs.insert_one({
        "_id": "foobar",
        "task": "create_sample",
        "args": {
            "sample_id": "baz",
            "files": [
                "foo.fq.gz"
            ]
        },
        "proc": 2,
        "mem": 4
    })

    job.init_db()

    return job


@pytest.mark.parametrize("exists", [None, "sample", "analysis"])
def test_make_sample_dir(exists, tmpdir, test_create_sample_job):
    """
    Test that the function makes the specified sample tree even if the sample path and/or the analysis path already
    exist.

    """
    test_create_sample_job.check_db()

    samples_path = os.path.join(str(tmpdir), "samples")

    sample_path = os.path.join(samples_path, "baz")

    if exists is not None:
        os.mkdir(sample_path)

        if exists == "analysis":
            os.mkdir(os.path.join(sample_path, "analysis"))

    test_create_sample_job.make_sample_dir()

    assert os.listdir(samples_path) == ["baz"]
    assert set(os.listdir(sample_path)) == {"analysis", "fastqc"}
