import os
import pickle
import pytest
import sys

import virtool.bio

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
TEST_BIO_PATH = os.path.join(TEST_FILES_PATH, "bio")


@pytest.fixture
def orf_containing():
    data = virtool.bio.read_fasta(os.path.join(TEST_BIO_PATH, "has_orfs.fa"))
    return data[0][1]


@pytest.mark.parametrize("illegal", [False, True])
def test_read_fasta(illegal, tmpdir):
    tmpfile = tmpdir.join("test.fa")

    content = (
        ">test_1\n"
        "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC\n"
        ">test_2\n"
        "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT\n"
    )

    if illegal:
        content = "ATTAGATAC\n" + content

    tmpfile.write(content)

    if illegal:
        with pytest.raises(IOError) as err:
            virtool.bio.read_fasta(str(tmpfile))

        assert "Illegal FASTA line: ATTAGATAC" in str(err)

    else:
        assert virtool.bio.read_fasta(str(tmpfile)) == [
            ("test_1", "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC"),
            ("test_2", "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT")
        ]


@pytest.mark.parametrize("illegal", [False, True])
def test_read_fasta(illegal, tmpdir):
    tmpfile = tmpdir.join("test.fa")

    content = (
        ">test_1\n"
        "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC\n"
        ">test_2\n"
        "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT\n"
    )

    if illegal:
        content = "ATTAGATAC\n" + content

    tmpfile.write(content)

    if illegal:
        with pytest.raises(IOError) as err:
            virtool.bio.read_fasta(str(tmpfile))

        assert "Illegal FASTA line: ATTAGATAC" in str(err)

    else:
        assert virtool.bio.read_fasta(str(tmpfile)) == [
            ("test_1", "ATAGAGTACATATCTACTTCTATCATTTATATATTATAAAAACCTC"),
            ("test_2", "CCTCTGACTGACTATGGGCTCTCGACTATTTACGATCAGCATCGTT")
        ]


@pytest.mark.parametrize("headers_only", [True, False], ids=["read_fastq_headers", "read_fastq"])
def test_fastq(headers_only, tmpdir):
    tmpfile = tmpdir.join("test.fa")

    with open(os.path.join(TEST_FILES_PATH, "test.fq"), "r") as f:
        lines = list()

        while len(lines) < 16:
            lines.append(f.readline())

    tmpfile.write("".join(lines))

    expected = [
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:1531:1859 1:N:0:AGTCAA',
            'NTGAGTATCTATTCTACAAATTCATTGATGTTTAGATGAATCGATATACATATTCATTAATAGTCTAGATCATGATATATACTTATCCCTCTAGGTGTCTG',
            '#1=DDDFFHHHHHJJJJJJJJJJJJJJIJJJJJJJHJJIIGJIHJHIIJJJJJJJIJJIIIJJIJJJJJJJJJJIGGIJIJJJJJIJJHHHHGFFDDFEEE'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:1648:1927 1:N:0:AGTCAA',
            'NTTGGCGGAATCAGCGGGGAAAGAAGACCCTGTTGAGCTTGACTCTAGTCCGACTTTGTGAAATGACTTGAGAGGTGTAGGATAAGTGGGAGCCGGAAACG',
            '#4=DFFFFHHHHHJJJJJJIJIJJJJJJJHHHHFFFFFFEEEEEEDDDEDDDDDDDDDDDDEDDDDDDDDCDBDDDACDDDDDDDDCDDDBDDDDDDDDDD'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:2306:1918 1:N:0:AGTCAA',
            'NCTCGCGGTACTTGTTTGCTATCGGTCTCTCGCCCGTATTTAGCCTTGGACGGAATTTACCGCCCGATTGGGGCTGCATTCCCAAACAACCCGACTCGCCG',
            '#4=DFFFFHHHHHJJJJJJJJJJJJIIJJJJJJJJJFHJJJJIJJIJJIJJHHFFFEEEEEDDDDDDDDDDDDDDBDDDEDEDDDDDDDDDDDDDDDDDD<'
        ),
        (
            '@HWI-ST1410:82:C2VAGACXX:7:1101:2582:1955 1:N:0:AGTCAA',
            'NATCGGAAGAGCACACGTCTGAACTCCAGTCACAGTCAACAATCTCGTATGCCGTCTTCTGCTTGAAAAAAAAAAAAAAAAACAAAAAAAAGAACATAATA',
            '#1=DFFFFHHHGHJJJJGHJJJJJJJJJJHIJJJJIIIJJJJGCHGHGIIGIJGFHHIJGJJIGFHHHFFD##############################'
        )
    ]

    if headers_only:
        assert virtool.bio.read_fastq_headers(str(tmpfile)) == [i[0] for i in expected]
    else:
        assert virtool.bio.read_fastq(str(tmpfile)) == expected


def test_reverse_complement():
    sequence = "ATAGGGATTAGAGACACAGATA"
    expected = "TATCTGTGTCTCTAATCCCTAT"

    assert virtool.bio.reverse_complement(sequence) == expected


@pytest.mark.parametrize("sequence,expected", [
    ("ATAGGGATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "IGIRDTDKERYRTCDVRTI*A"),
    ("ATACCNATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "IPIRDTDKERYRTCDVRTI*A"),
    ("ATNGGGATTAGAGACACAGATAAGGAGAGATATAGAACATGTGACGTACGTACGATCTGAGCTA", "XGIRDTDKERYRTCDVRTI*A"),
], ids=["no_ambiguous", "ambiguous", "ambigous_x"])
def test_translate(sequence, expected):
    """
    Test that translation works properly. Cases are standard, resolvable ambiguity, and non-resolvable ambiguity (X).

    """
    assert virtool.bio.translate(sequence) == expected


def test_find_orfs(orf_containing):
    result = virtool.bio.find_orfs(orf_containing)

    with open(os.path.join(TEST_BIO_PATH, "orfs"), "rb") as f:
        assert pickle.load(f) == result
