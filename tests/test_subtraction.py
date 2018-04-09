import os
import pytest

import virtool.subtraction


@pytest.fixture
def write_mock_fasta(tmpdir):
    lines = [
        ">foo\n",
        "ATGGACTGGTTCTCTCTCTCTAGGCACTG\n",
        ">bar\n",
        "GGGTCGGCGCGGACATTCGGACTTATTAG\n",
        ">baz\n",
        "TTTCGACTTGACTTCTTNTCTCATGCGAT"
    ]

    def func(path):
        with open(path, "w") as handle:
            for line in lines:
                handle.write(line)

    return func




@pytest.fixture
def mock_fasta(tmpdir, write_mock_fasta):
    fasta_path = os.path.join(str(tmpdir), "test.fa")

    write_mock_fasta(fasta_path)

    return fasta_path


async def test_calculate_gc(mock_fasta):
    assert virtool.subtraction.calculate_fasta_gc(mock_fasta) == ({
        "a": 0.149,
        "t": 0.345,
        "g": 0.253,
        "c": 0.241,
        "n": 0.011
    }, 3)
