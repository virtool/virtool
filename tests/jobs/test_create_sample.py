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
                {
                    "id": "foo.fq.gz"
                }
            ]
        },
        "proc": 2,
        "mem": 4
    })

    job.init_db()

    return job


def test_check_db(mocker, test_create_sample_job):
    expected = {
        "foo": "bar"
    }

    m_get_sample_params = mocker.patch("virtool.jobs.utils.get_sample_params", return_value=expected)

    test_create_sample_job.check_db()

    m_get_sample_params.assert_called_with(
        test_create_sample_job.db,
        test_create_sample_job.settings,
        {
            "sample_id": "baz",
            "files": [{
                "id": "foo.fq.gz"
            }]
        }
    )

    assert test_create_sample_job.params == expected


@pytest.mark.parametrize("exists", [None, "sample", "fastqc", "analysis"])
def test_make_sample_dir(exists, tmpdir, test_create_sample_job):
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







