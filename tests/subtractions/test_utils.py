import pytest

from virtool.subtractions.utils import (
    check_subtraction_file_type,
    get_subtraction_files,
)


async def test_get_subtraction_files(snapshot, pg, test_subtraction_files):
    assert await get_subtraction_files(pg, test_subtraction_files) == snapshot


@pytest.mark.parametrize("file_type", ["fasta", "bowtie2"])
def test_check_subtraction_file_type(file_type):
    if file_type == "fasta":
        result = check_subtraction_file_type("subtraction.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = check_subtraction_file_type("subtraction.1.bt2")
        assert result == "bowtie2"
