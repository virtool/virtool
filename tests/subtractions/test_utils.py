import os

import virtool.subtractions.utils


def test_join_subtraction_path():
    settings = {
        "data_path": "/foo"
    }

    path = virtool.subtractions.utils.join_subtraction_path(settings, "bar")

    assert path == "/foo/subtractions/bar"


def test_prepare_files_field(tmpdir):
    test_dir = tmpdir.mkdir("subtractions")
    test_dir.join("subtraction.fa.gz").write("FASTA file")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")
    path = os.path.join(tmpdir, "subtractions")

    files = virtool.subtractions.utils.prepare_files_field(path)

    assert files == [
        {
            'size': os.stat(os.path.join(path, "subtraction.1.bt2")).st_size,
            'name': 'subtraction.1.bt2',
            'type': 'bowtie2'
        },
        {
            'size': os.stat(os.path.join(path, "subtraction.fa.gz")).st_size,
            'name': 'subtraction.fa.gz',
            'type': 'fasta'
        }
    ]


def test_rename_bowtie_files(tmpdir):
    test_dir = tmpdir.mkdir("subtractions")
    test_dir.join("reference.1.bt2").write("Bowtie2 file")
    test_dir.join("reference.2.bt2").write("Bowtie2 file")
    test_dir.join("reference.3.bt2").write("Bowtie2 file")
    path = os.path.join(tmpdir, "subtractions")

    virtool.subtractions.utils.rename_bowtie_files(path)
    assert os.listdir(path) == ['subtraction.1.bt2', 'subtraction.2.bt2', 'subtraction.3.bt2']
