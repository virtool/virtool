import virtool.indexes.utils
from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
)


async def test_check_index_file_type_json():
    result = virtool.indexes.utils.check_index_file_type("reference.json.gz")

    assert result == "json"


async def test_check_index_file_type_reference_json_v2():
    result = virtool.indexes.utils.check_index_file_type("reference-v2.json.gz")

    assert result == "json"


async def test_check_index_file_type_fasta():
    result = virtool.indexes.utils.check_index_file_type("reference.fa.gz")

    assert result == "fasta"


async def test_check_index_file_type_bowtie2():
    result = virtool.indexes.utils.check_index_file_type("reference.1.bt2")

    assert result == "bowtie2"


def test_compose_index_file_key():
    assert (
        compose_index_file_key("abc123", "reference.fa.gz")
        == "indexes/abc123/reference.fa.gz"
    )


def test_compose_index_prefix():
    assert compose_index_prefix("abc123") == "indexes/abc123/"
