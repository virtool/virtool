import pytest

import virtool.caches.db
import virtool.caches.utils
import virtool.jobs.utils


@pytest.mark.parametrize("gzipped", [True, False])
@pytest.mark.parametrize("proc", [2, 4])
def test_copy_or_compress(gzipped, proc, mocker):
    path = "/mnt/baz/test.file"
    target = "/mnt/bar/foo.file"

    mocker.patch("virtool.utils.is_gzipped", return_value=gzipped)

    m_copyfile = mocker.patch("shutil.copyfile")

    m_compress_file = mocker.patch("virtool.utils.compress_file", return_value=gzipped)

    virtool.jobs.utils.copy_or_compress(path, target, proc)

    if not gzipped:
        m_compress_file.assert_called_with(path, target, processes=proc)
        m_copyfile.assert_not_called()
        return

    m_compress_file.assert_not_called()
    m_copyfile.assert_called_with(path, target)


async def test_get_sample_params(dbi):
    settings = {
        "data_path": "/mnt/hdd"
    }

    task_args = {
        "sample_id": "foo",
        "hello": "world"
    }

    files = [
        {"id": "abc1234-reads_a_1.fq.gz"},
        {"id": "hj1d821-reads_a_2.fq.gz"}
    ]

    document = {
        "_id": "foo",
        "files": files,
        "paired": True
    }

    await dbi.samples.insert_one(document)

    result = await virtool.jobs.utils.get_sample_params(dbi, settings, task_args)

    assert result == {
        "sample_id": "foo",
        "sample_path": "/mnt/hdd/samples/foo",
        "hello": "world",
        "document": document,
        "paired": True,
        "files": files
    }
