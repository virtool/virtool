import os

import pytest

import virtool.subtractions.utils


def test_join_subtraction_path(tmp_path):
    settings = {
        "data_path": tmp_path
    }

    path = virtool.subtractions.utils.join_subtraction_path(settings, "bar")

    assert path == tmp_path / "subtractions" / "bar"


async def test_get_subtraction_files(pg, test_subtraction_files):
    files = await virtool.subtractions.utils.get_subtraction_files(pg, "foo")

    assert files == [
            {
                'id': 1,
                'name': 'subtraction.fq.gz',
                'subtraction': 'foo',
                'type': 'fasta',
                'size': 12345,
                'download_url': '/api/subtractions/foo/files/subtraction.fq.gz'
            },
            {
                'id': 2,
                'name': 'subtraction.1.bt2',
                'subtraction': 'foo',
                'type': 'bowtie2',
                'size': 56437,
                'download_url': '/api/subtractions/foo/files/subtraction.1.bt2'

            },
            {
                'id': 3,
                'name': 'subtraction.2.bt2',
                'subtraction': 'foo',
                'type': 'bowtie2',
                'size': 93845,
                'download_url': '/api/subtractions/foo/files/subtraction.2.bt2'
            }
        ]


def test_rename_bowtie_files(tmp_path):
    test_dir = tmp_path / "subtractions"
    test_dir.mkdir()

    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")
    test_dir.joinpath("reference.2.bt2").write_text("Bowtie2 file")
    test_dir.joinpath("reference.3.bt2").write_text("Bowtie2 file")

    virtool.subtractions.utils.rename_bowtie_files(test_dir)
    assert set(os.listdir(test_dir)) == {'subtraction.1.bt2', 'subtraction.2.bt2', 'subtraction.3.bt2'}


@pytest.mark.parametrize("file_type", ["fasta", "bowtie2"])
def test_check_subtraction_file_type(file_type):
    if file_type == "fasta":
        result = virtool.subtractions.utils.check_subtraction_file_type("subtraction.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = virtool.subtractions.utils.check_subtraction_file_type("subtraction.1.bt2")
        assert result == "bowtie2"
