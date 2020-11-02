import pytest

import virtool.files.utils


@pytest.mark.parametrize("filename,expected", [
    ("test.fq.gz", True),
    ("test.fastq.gz", True),
    ("test.fq", True),
    ("test.fastq", True),
    ("test.fa.gz", False),
    ("test.zip", False),
    ("test.fa", False),
    ("test.gz", False)
])
def test_has_read_extension(filename, expected):
    """
    Test that read extensions can be detected reliably.

    """
    assert virtool.files.utils.has_read_extension(filename) == expected


def test_join_file_path():
    """
    Test that the file path is joined as expected.

    """
    settings = {
        "data_path": "/foo"
    }

    result = virtool.files.utils.join_file_path(settings, "123-bar.fq.gz")

    assert result == "/foo/files/123-bar.fq.gz"
