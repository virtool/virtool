from virtool.subtractions.utils import (
    check_subtraction_file_type,
    get_subtraction_files,
)


async def test_get_subtraction_files(snapshot, pg, test_subtraction_files):
    assert await get_subtraction_files(pg, test_subtraction_files) == snapshot


class TestCheckSubtractionFileType:
    def test_fasta(self):
        assert check_subtraction_file_type("subtraction.fa.gz") == "fasta"

    def test_bowtie2(self):
        assert check_subtraction_file_type("subtraction.1.bt2") == "bowtie2"
