import pytest

import virtool.jobs.update_sample


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

    job = virtool.jobs.update_sample.Job(
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


@pytest.mark.parametrize("paired", [True, False])
def test_copy_files(paired, mocker, test_update_sample_job):
    files = [
        {
            "replacement": {
                "id": "foo_replacement_1.fq.gz"
            }
        }
    ]

    if paired:
        files.append({
            "replacement": {
                "id": "foo_replacement_2.fq.gz"
            }
        })

    test_update_sample_job.params = {
        "sample_id": "baz",
        "sample_path": "/samples/baz",
        "paired": paired,
        "files": files
    }

    test_update_sample_job.settings["data_path"] = "/data"

    sizes = [1234]

    if paired:
        sizes.append(1235)

    m_copy_files_to_sample = mocker.patch("virtool.jobs.utils.copy_files_to_sample", return_value=sizes)

    test_update_sample_job.copy_files()

    expected_paths = ["/data/files/foo_replacement_1.fq.gz"]

    if paired:
        expected_paths.append("/data/files/foo_replacement_2.fq.gz")

    m_copy_files_to_sample.assert_called_with(
        expected_paths,
        "/samples/baz",
        test_update_sample_job.proc
    )

    expected_raw = [{
        "download_url": "/download/samples/baz/reads_1.fq.gz",
        "name": "reads_1.fq.gz",
        "size": 1234,
        "from": {
            "replacement": {
                "id": "foo_replacement_1.fq.gz"
            }
        }
    }]

    if paired:
        expected_raw.append({
        "download_url": "/download/samples/baz/reads_2.fq.gz",
        "name": "reads_2.fq.gz",
        "size": 1235,
        "from": {
            "replacement": {
                "id": "foo_replacement_2.fq.gz"
            }
        }
    })

    assert test_update_sample_job.intermediate["raw"] == expected_raw
