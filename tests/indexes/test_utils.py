import gzip
import json

import virtool.indexes.utils
from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
    iter_compressed_reference_ndjson,
)


async def test_check_index_file_type_json():
    result = virtool.indexes.utils.check_index_file_type("reference.json.gz")

    assert result == "json"


async def test_check_index_file_type_ndjson():
    result = virtool.indexes.utils.check_index_file_type("reference.ndjson.gz")

    assert result == "ndjson"


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


async def test_iter_compressed_reference_ndjson_preserves_record_type():
    async def iter_otus():
        yield {"_id": "foo", "type": "reference"}

    chunks = [
        chunk
        async for chunk in iter_compressed_reference_ndjson(
            {"id": "hxn167", "type": "otu"},
            iter_otus(),
        )
    ]

    records = [
        json.loads(line)
        for line in gzip.decompress(b"".join(chunks)).decode().splitlines()
    ]

    assert records == [
        {"id": "hxn167", "type": "reference"},
        {"_id": "foo", "type": "otu"},
    ]
