import os

import pytest

from virtool.subtractions.utils import (
    check_subtraction_file_type,
    get_subtraction_files,
    rename_bowtie_files,
    subtraction_file_key,
    subtraction_prefix,
)


def test_subtraction_file_key():
    assert (
        subtraction_file_key("abc123", "subtraction.1.bt2")
        == "subtractions/abc123/subtraction.1.bt2"
    )


def test_subtraction_file_key_with_spaces():
    assert (
        subtraction_file_key("foo bar", "subtraction.fa.gz")
        == "subtractions/foo_bar/subtraction.fa.gz"
    )


def test_subtraction_prefix():
    assert subtraction_prefix("abc123") == "subtractions/abc123/"


def test_subtraction_prefix_with_spaces():
    assert subtraction_prefix("foo bar") == "subtractions/foo_bar/"


async def test_get_subtraction_files(snapshot, pg, test_subtraction_files):
    assert await get_subtraction_files(pg, "foo") == snapshot


async def test_rename_bowtie_files(tmp_path):
    test_dir = tmp_path / "subtractions"
    test_dir.mkdir()

    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")
    test_dir.joinpath("reference.2.bt2").write_text("Bowtie2 file")
    test_dir.joinpath("reference.3.bt2").write_text("Bowtie2 file")

    await rename_bowtie_files(test_dir)

    assert set(os.listdir(test_dir)) == {
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
    }


@pytest.mark.parametrize("file_type", ["fasta", "bowtie2"])
def test_check_subtraction_file_type(file_type):
    if file_type == "fasta":
        result = check_subtraction_file_type("subtraction.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = check_subtraction_file_type("subtraction.1.bt2")
        assert result == "bowtie2"
