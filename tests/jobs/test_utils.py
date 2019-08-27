import pytest

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


def test_get_sample_params(dbs):

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

    dbs.samples.insert_one(document)

    result = virtool.jobs.utils.get_sample_params(dbs, settings, task_args)

    assert result == {
        "sample_id": "foo",
        "sample_path": "/mnt/hdd/samples/foo",
        "fastqc_path": "/mnt/hdd/samples/foo/fastqc",
        "analysis_path": "/mnt/hdd/samples/foo/analysis",
        "hello": "world",
        "document": document,
        "paired": True,
        "files": files
    }


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("returned_hash", ["abc123", "foobar"])
def test_find_cache(exists, returned_hash, mocker, dbs):
    parameters = {
        "a": 1,
        "b": "hello",
        "c": "world"
    }

    if exists:
        dbs.caches.insert_one({
            "_id": "bar",
            "program": "skewer-0.2.2",
            "hash": "abc123",
            "sample": {
                "id": "foo"
            }
        })

    m_calculate_cache_hash = mocker.patch("virtool.caches.db.calculate_cache_hash", return_value=returned_hash)

    result = virtool.jobs.utils.find_cache(dbs, "foo", "skewer-0.2.2", parameters)

    m_calculate_cache_hash.assert_called_with(parameters)

    if not exists or returned_hash == "foobar":
        assert result is None
        return

    assert result == {
        "id": "bar",
        "program": "skewer-0.2.2",
        "hash": "abc123",
        "sample": {
            "id": "foo"
        }
    }


def test_join_cache_path():
    settings = {
        "data_path": "/mnt/foo"
    }

    cache_id = "bar"

    assert virtool.jobs.utils.join_cache_path(settings, cache_id) == "/mnt/foo/caches/bar"


@pytest.mark.parametrize("paired,paths", [
    (True, ["/mnt/foo/caches/bar/reads_1.fq.gz", "/mnt/foo/caches/bar/reads_2.fq.gz"]),
    (False, ["/mnt/foo/caches/bar/reads_1.fq.gz"])
])
@pytest.mark.parametrize("exists", [True, False])
def test_join_cache_read_paths(paired, paths, exists):
    """
    Test that the correct read paths are returned when the data is paired or unpaired and when the cache is not defined.

    """
    settings = {
        "data_path": "/mnt/foo"
    }

    cache = None

    if exists:
        cache = {
            "id": "bar",
            "paired": paired
        }

    result = virtool.jobs.utils.join_cache_read_paths(settings, cache)

    if exists:
        assert result == paths
        return

    assert result is None
