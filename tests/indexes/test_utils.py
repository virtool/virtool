import pytest

import virtool.indexes.utils


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
