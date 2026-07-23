from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
)


def test_compose_index_file_key():
    assert (
        compose_index_file_key("abc123", "reference.fa.gz")
        == "indexes/abc123/reference.fa.gz"
    )


def test_compose_index_prefix():
    assert compose_index_prefix("abc123") == "indexes/abc123/"
