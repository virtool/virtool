from virtool.caches.utils import join_cache_path


def test_join_cache_path(tmp_path, config):
    cache_id = "bar"

    assert join_cache_path(config, cache_id) == tmp_path / "caches" / "bar"
