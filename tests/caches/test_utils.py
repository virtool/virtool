import pytest

import virtool.caches.utils


def test_join_cache_path(tmp_path):
    settings = {
        "data_path": tmp_path
    }

    cache_id = "bar"

    assert virtool.caches.utils.join_cache_path(settings, cache_id) == tmp_path / "caches" / "bar"


@pytest.mark.parametrize("paired,paths", [
    (True, ["caches/bar/reads_1.fq.gz", "caches/bar/reads_2.fq.gz"]),
    (False, ["caches/bar/reads_1.fq.gz"])
])
@pytest.mark.parametrize("exists", [True, False])
def test_join_cache_read_paths(paired, paths, exists, tmp_path):
    """
    Test that the correct read paths are returned when the data is paired or unpaired and when the cache is not defined.

    """
    settings = {
        "data_path": tmp_path
    }

    paths = [tmp_path / path for path in paths]

    cache = None

    if exists:
        cache = {
            "id": "bar",
            "paired": paired
        }

    result = virtool.caches.utils.join_cache_read_paths(settings, cache)

    if exists:
        assert result == paths
        return

    assert result is None