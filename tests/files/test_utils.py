import aionotify
import pytest

import virtool.files.utils


@pytest.mark.parametrize("flag,event_type", [
    (aionotify.Flags.CREATE, "create"),
    (aionotify.Flags.DELETE, "delete"),
    (aionotify.Flags.CLOSE_WRITE, "close"),
    (aionotify.Flags.MOVED_FROM, "delete"),
    (aionotify.Flags.MOVED_TO, "create")
])
def test_get_event_type(flag, event_type, mocker):
    """
    Test that function can interpret event objects to event types.

    """
    m_parse = mocker.patch("aionotify.Flags.parse", return_value=[flag])

    class Event:
        flags = [flag]

    assert virtool.files.utils.get_event_type(Event()) == event_type
    m_parse.assert_called_with([flag])


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
