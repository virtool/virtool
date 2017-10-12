import os
import pickle
import pytest
import sys

import virtool.bio

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files", "bio")


@pytest.fixture
def orf_containing():
    data = virtool.bio.read_fasta(os.path.join(TEST_FILES_PATH, "has_orfs.fa"))
    return data[0][1]


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

    with open(os.path.join(TEST_FILES_PATH, "orfs"), "rb") as f:
        assert pickle.load(f) == result
