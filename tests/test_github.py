import os
import pytest
import shutil
import sys
from aiohttp.test_utils import make_mocked_coro

import virtool.errors
import virtool.github


@pytest.mark.parametrize("error", [None, "url", "write"])
async def test_download_asset(error, tmpdir, capsys):
    url = "https://github.com/linux-test-project/ltp/releases/download/20170516/ltp-full-20170516.tar.bz2"

    if error == "url":
        url = "https://github.com/virtool/virtool/releases/download/v1.8.5/foobar.tar.gz"

    size = 3664835

    path = str(tmpdir)

    target_path = os.path.join(path, "release.tar.gz")

    if error == "write":
        target_path = "/foobar/this/should/not-exist"

    handler = make_mocked_coro()

    task = virtool.github.download_asset(url, size, target_path, progress_handler=handler)

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


