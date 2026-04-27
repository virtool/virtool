import pytest

import virtool.indexes.utils
from virtool.indexes.utils import compose_index_file_key, compose_index_prefix


@pytest.mark.parametrize("file_type", ["json", "fasta", "bowtie2"])
async def test_check_index_file_type(file_type):
    if file_type == "json":
        result = virtool.indexes.utils.check_index_file_type("reference.json.gz")
        assert result == "json"

    if file_type == "fasta":
        result = virtool.indexes.utils.check_index_file_type("reference.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = virtool.indexes.utils.check_index_file_type("reference.1.bt2")
        assert result == "bowtie2"


def test_compose_index_file_key():
    assert (
        compose_index_file_key("abc123", "reference.1.bt2")
        == "indexes/abc123/reference.1.bt2"
    )


def test_compose_index_prefix():
    assert compose_index_prefix("abc123") == "indexes/abc123/"
