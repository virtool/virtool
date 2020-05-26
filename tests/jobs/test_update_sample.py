import pytest

import virtool.jobs.update_sample


@pytest.fixture
async def mock_job(mocker, tmpdir, loop, request, dbi, test_db_connection_string, test_db_name):
    tmpdir.mkdir("samples")
    tmpdir.mkdir("logs").mkdir("jobs")

    job = virtool.jobs.update_sample.create()

    job.id = "foobar"
    job.db = dbi
    job.settings = {
        "data_path": str(tmpdir),
        "proc": 1,
        "mem": 4
    }

    await dbi.jobs.insert_one({
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

    await dbi.samples.insert_one({
        "_id": "baz",
        "paired": False
    })

    return job


async def test_check_db(mocker, mock_job):
    expected = {
        "id": "foo",
        "name": "Bar"
    }

    m_get_sample_params = mocker.patch("virtool.jobs.utils.get_sample_params", return_value=expected)

    await virtool.jobs.update_sample.check_db(mock_job)

    # Make sure get_sample_params() called with correct parameters.
    m_get_sample_params.assert_called_with(
        mock_job.db,
        mock_job.settings,
        mock_job.task_args
    )

    # Result is set as Job.params attribute.
    assert mock_job.params == expected


@pytest.mark.parametrize("paired", [True, False])
async def test_copy_files(paired, mocker, mock_job):
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

    mock_job.params = {
        "sample_id": "baz",
        "sample_path": "/samples/baz",
        "paired": paired,
        "files": files
    }

    mock_job.settings["data_path"] = "/data"

    sizes = [1234]

    if paired:
        sizes.append(1235)

    m_copy_files_to_sample = mocker.patch("virtool.jobs.utils.copy_files_to_sample", return_value=sizes)

    await virtool.jobs.update_sample.copy_files(mock_job)

    expected_paths = ["/data/files/foo_replacement_1.fq.gz"]

    if paired:
        expected_paths.append("/data/files/foo_replacement_2.fq.gz")

    m_copy_files_to_sample.assert_called_with(
        expected_paths,
        "/samples/baz",
        mock_job.proc
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

    assert mock_job.intermediate["raw"] == expected_raw
