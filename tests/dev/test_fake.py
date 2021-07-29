from os.path import isdir

from virtool.dev.fake import create_fake_data_path


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in str(path)
    assert isdir(path)