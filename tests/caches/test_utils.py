import virtool.caches.utils


def test_join_cache_path(tmp_path):
    settings = {
        "data_path": tmp_path
    }

    cache_id = "bar"

    assert virtool.caches.utils.join_cache_path(settings, cache_id) == tmp_path / "caches" / "bar"
