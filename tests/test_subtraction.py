import virtool.subtractions.utils


async def test_calculate_gc(tmp_path):
    lines = [
        ">foo\n",
        "ATGGACTGGTTCTCTCTCTCTAGGCACTG\n",
        ">bar\n",
        "GGGTCGGCGCGGACATTCGGACTTATTAG\n",
        ">baz\n",
        "TTTCGACTTGACTTCTTNTCTCATGCGAT"
    ]

    path = tmp_path / "test.fa"

    with open(path, "w") as handle:
        for line in lines:
            handle.write(line)

    assert await virtool.subtractions.utils.calculate_fasta_gc(path) == ({
        "a": 0.149,
        "t": 0.345,
        "g": 0.253,
        "c": 0.241,
        "n": 0.011
    }, 3)
