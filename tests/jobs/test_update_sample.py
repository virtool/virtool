import pytest

import virtool.jobs.create_sample


@pytest.fixture
def test_update_sample_job(mocker, tmpdir, loop, request, dbi, dbs, test_db_connection_string, test_db_name):
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
        "task": "update_sample",
        "args": {
            "sample_id": "baz",
            "files": [
                {
                    "id": "foo.fq.gz",
                    "replacement": {
                        "id": "foo_replacement.fq.gz"
                    }
                }
            ]
        },
        "proc": 2,
        "mem": 4
    })

    dbs.samples.insert_one({
        "_id": "baz",
        "paired": False
    })

    job.init_db()

    return job


def test_check_db(mocker, test_update_sample_job):
    expected = {
        "id": "foo",
        "name": "Bar"
    }

    m_get_sample_params = mocker.patch("virtool.jobs.utils.get_sample_params", return_value=expected)

    test_update_sample_job.check_db()

    # Make sure get_sample_params() called with correct parameters.
    m_get_sample_params.assert_called_with(
        test_update_sample_job.db,
        test_update_sample_job.settings,
        test_update_sample_job.task_args
    )

    # Result is set as Job.params attribute.
    assert test_update_sample_job.params == expected


def test_copy_files(mocker, test_update_sample_job):
    test_update_sample_job.copy_files()

    m_copy_or_compress = mocker.patch("virtool.jobs.utils.copy_or_compress")

    m_file_stats = mocker.patch("virtool.utils.file_stats", return_value={
        "size": 12345
    })




