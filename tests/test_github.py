import os
import pytest
import shutil
import sys
from aiohttp.test_utils import make_mocked_coro

import virtool.errors
import virtool.github


def test_get_headers():
    assert virtool.github.get_headers("v1.9.2-beta.2") == {
        "user-agent": "virtool/v1.9.2-beta.2",
        "Accept": "application/vnd.github.v3+json"
    }


@pytest.mark.parametrize("username,token", [
    (None, None),
    ("fred", None),
    (None, "abc123"),
    ("fred", "abc123")
])
async def test_create_session(username, token):
    """
    Test that a GitHub API compatible session is created as expected. When any auth parameters are missing, auth will
    not be used.

    """
    auth = virtool.github.create_auth(username, token)

    if username and token:
        assert auth.login == "fred"
        assert auth.password == "abc123"
    else:
        assert auth is None


@pytest.mark.parametrize("error", [None, "url", "write"])
async def test_download_asset(error, tmpdir):
    url = "https://github.com/linux-test-project/ltp/releases/download/20170516/ltp-full-20170516.tar.bz2"

    if error == "url":
        url = "https://github.com/virtool/virtool/releases/download/v1.8.5/foobar.tar.gz"

    size = 3664835

    path = str(tmpdir)

    target_path = os.path.join(path, "release.tar.gz")

    if error == "write":
        target_path = "/foobar/this/should/not-exist"

    handler = make_mocked_coro()

    task = virtool.github.download_asset({"proxy_enable": False}, url, size, target_path, progress_handler=handler)

    if error == "url":
        with pytest.raises(virtool.errors.GitHubError) as err:
            await task

        assert "Could not download release" in str(err)

    elif error == "write":
        with pytest.raises(FileNotFoundError):
            await task

    else:
        await task

        call_args_list = handler.call_args_list

        # All passed progress values are floats less than or equal to 1.
        assert all(isinstance(c[0][0], float) and c[0][0] <= 1 for c in call_args_list)

        # The last passed progress value was 1.0.
        assert call_args_list[-1][0][0] == 1.0

    if error:
        assert os.listdir(path) == []
    else:
        assert os.listdir(path) == ["release.tar.gz"]

    if not error:
        assert os.path.getsize(target_path) == 3664835


def test_decompress_asset_file(tmpdir):
    path = str(tmpdir)

    src_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")

    shutil.copy(src_path, path)

    virtool.github.decompress_asset_file(os.path.join(path, "virtool.tar.gz"), os.path.join(path, "de"))

    assert set(os.listdir(path)) == {"virtool.tar.gz", "de"}

    assert os.listdir(os.path.join(path, "de")) == ["virtool"]

    assert set(os.listdir(os.path.join(path, "de", "virtool"))) == {"run", "client", "VERSION", "install.sh"}


