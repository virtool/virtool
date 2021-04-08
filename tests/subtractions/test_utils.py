import os

import pytest

import virtool.subtractions.utils


def test_join_subtraction_path():
    settings = {
        "data_path": "/foo"
    }

    path = virtool.subtractions.utils.join_subtraction_path(settings, "bar")

    assert path == "/foo/subtractions/bar"


async def test_get_subtraction_files(pg, test_subtraction_files):
    files = await virtool.subtractions.utils.get_subtraction_files(pg, "foo")

    assert files == [
            {
                'id': 1,
                'name': 'subtraction.fa.gz',
                'subtraction': 'foo',
                'type': 'fasta',
                'size': 12345
            },
            {
                'id': 2,
                'name': 'subtraction.1.bt2',
                'subtraction': 'foo',
                'type': 'bowtie2',
                'size': 56437
            },
            {
                'id': 3,
                'name': 'subtraction.2.bt2',
                'subtraction': 'foo',
                'type': 'bowtie2',
                'size': 93845
            }
        ]


def test_rename_bowtie_files(tmpdir):
    test_dir = tmpdir.mkdir("subtractions")
    test_dir.join("reference.1.bt2").write("Bowtie2 file")
    test_dir.join("reference.2.bt2").write("Bowtie2 file")
    test_dir.join("reference.3.bt2").write("Bowtie2 file")
    path = os.path.join(tmpdir, "subtractions")

    virtool.subtractions.utils.rename_bowtie_files(path)
    assert set(os.listdir(path)) == {'subtraction.1.bt2', 'subtraction.2.bt2', 'subtraction.3.bt2'}


@pytest.mark.parametrize("file_type", ["fasta", "bowtie2"])
def test_check_subtraction_file_type(file_type):
    if file_type == "fasta":
        result = virtool.subtractions.utils.check_subtraction_file_type("subtraction.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = virtool.subtractions.utils.check_subtraction_file_type("subtraction.1.bt2")
        assert result == "bowtie2"
