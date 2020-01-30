import os
import sys
import virtool.db.sync

TEST_DIFF_PATH = os.path.join(sys.path[0], "tests", "test_files", "diff.json")


def test_read_diff_file(mocker, snapshot):
    """
        Test that a diff is parsed to a `dict` correctly. ISO format dates must be converted to `datetime` objects.

        """
    m = mocker.patch("virtool.history.utils.join_diff_path", return_value=TEST_DIFF_PATH)

    diff = virtool.db.sync.read_diff_file("foo", "bar", "baz")

    m.assert_called_with("foo", "bar", "baz")
    snapshot.assert_match(diff)
