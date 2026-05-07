from pathlib import Path

from virtool.caches.storage import cache_blob_path


def test_cache_blob_path_shards_on_first_two_chars(tmp_path: Path):
    key = "abcdef0123456789"

    assert (
        cache_blob_path(tmp_path, key) == tmp_path / "storage" / "caches" / "ab" / key
    )


def test_cache_blob_path_root_is_relative_to_data_path():
    data_path = Path("/srv/virtool")
    key = "0011223344556677"

    assert (
        cache_blob_path(data_path, key) == Path("/srv/virtool/storage/caches/00") / key
    )
