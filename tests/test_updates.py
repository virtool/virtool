import os
import sys
import shutil
import pytest
import tarfile
import tempfile
from concurrent.futures import ThreadPoolExecutor
from aiohttp.test_utils import make_mocked_coro

import virtool.errors
import virtool.updates


def test_format_software_release():
    formatted = virtool.updates.format_software_release({
        "html_url": "https://github.com/virtool/virtool/releases/tag/v1.8.5",
        "tag_name": "v1.8.5",
        "name": "v1.8.5",
        "draft": False,
        "prerelease": False,
        "published_at": "2017-03-24T21:03:18Z",
        "assets": [
            {
                "url": "https://api.github.com/repos/virtool/virtool/releases/assets/3483395",
                "name": "virtool.tar.gz",
                "content_type": "application/gzip",
                "state": "uploaded",
                "size": 49963781,
                "browser_download_url": "https://github.com/virtool/virtool/releases/download/v1.8.5/virtool.tar.gz"
            }
        ],
        "body": "- add software tests for `hmm.py` module\r\n- allow upload and import of `*.hmm` profile files and "
                "annotations\r\n- remove dropdown menu for checking `*hmm` files\r\n- show _none found_ message when "
                "there are no annotations\r\n- fix #90"
    })

    assert formatted == {
        "name": "v1.8.5",
        "body": "- add software tests for `hmm.py` module\r\n- allow upload and import of `*.hmm` profile files "
                "and annotations\r\n- remove dropdown menu for checking `*hmm` files\r\n- show _none found_ message "
                "when there are no annotations\r\n- fix #90",
        "prerelease": False,
        "published_at": "2017-03-24T21:03:18Z",
        "html_url": "https://github.com/virtool/virtool/releases/tag/v1.8.5",
        "filename": "virtool.tar.gz",
        "content_type": "application/gzip",
        "size": 49963781,
        "download_url": "https://github.com/virtool/virtool/releases/download/v1.8.5/virtool.tar.gz",
        "asset_error": False
    }


@pytest.mark.parametrize("download_release_error", [None, virtool.errors.GitHubError, FileNotFoundError])
async def test_install(download_release_error, loop, tmpdir, monkeypatch, mocker, test_motor, test_dispatch):
    # This the replacement for the TemporaryDirectory that would normally be used by install().
    temp_dir = None

    def m_get_tempdir():
        global temp_dir
        temp_dir = tempfile.TemporaryDirectory(dir=str(tmpdir))
        return temp_dir

    async def m_download_asset(settings, url, size, target_path, progress_handler=None):
        if download_release_error:
            raise download_release_error

        src_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")
        shutil.copyfile(src_path, target_path)

    await test_motor.status.insert_one({
        "_id": "software_update",
        "process": {
            "size": 34091211,
            "step": "block_jobs",
            "progress": 0,
            "good_tree": True
        }
    })

    monkeypatch.setattr("virtool.github.download_asset", m_download_asset)

    monkeypatch.setattr("virtool.updates.get_temp_dir", m_get_tempdir)

    m_update_software_process = make_mocked_coro()
    monkeypatch.setattr("virtool.updates.update_software_process", m_update_software_process)

    m_reload = make_mocked_coro()
    monkeypatch.setattr("virtool.utils.reload", m_reload)

    install_path = str(tmpdir.mkdir("virtool_install"))

    monkeypatch.setattr("virtool.updates.INSTALL_PATH", install_path)

    loop.set_default_executor(ThreadPoolExecutor())

    app = mocker.Mock()

    setattr(app, "on_shutdown", [
        make_mocked_coro(),
        make_mocked_coro()
    ])

    await virtool.updates.install(app, test_motor, {"proxy_enable": False}, test_dispatch, loop, "foobar", 1234)

    if not download_release_error:
        assert set(os.listdir(install_path)) == {"run", "client", "VERSION", "install.sh"}
        assert set(os.listdir(os.path.join(install_path, "client"))) == {
            "app.a006b17bf13ea9cb7827.js",
            "favicon.ico",
            "index.html"
        }

        document = await test_motor.status.find_one("software_update", ["process"])

        assert document["process"]["complete"] is True

        assert m_reload.called

    else:
        assert os.listdir(install_path) == []

        document = await test_motor.status.find_one("software_update", ["process"])

        error = document["process"]["error"]

        if download_release_error == virtool.errors.GitHubError:
            assert error == "Could not find GitHub repository"
        else:
            assert error == "Could not write to release download location"

        assert not m_reload.called


@pytest.mark.parametrize("step", ["download_release", "check_tree"])
@pytest.mark.parametrize("progress", [0.1, 0.3])
async def test_update_software_process(progress, step, test_motor, test_dispatch):
    await test_motor.status.insert_one({
        "_id": "software_update",
        "process": {
            "size": 34091211,
            "step": "block_jobs",
            "progress": 0
        }
    })

    await virtool.updates.update_software_process(test_motor, test_dispatch, progress, step=step)

    assert await test_motor.status.find_one("software_update") == {
        "_id": "software_update",
        "process": {
            "size": 34091211,
            "step": step or "block_jobs",
            "progress": progress
        }
    }


@pytest.mark.parametrize("missing_path,p_result", [(None, True), ("run", False), ("VERSION", False)])
@pytest.mark.parametrize("missing_client,c_result", [
    (None, True),
    ("dir", False),
    ("app.foobar.js", False),
    ("favicon.ico", False),
    ("index.html", False)
])
def test_check_tree(missing_path, p_result, missing_client, c_result, tmpdir):
    paths_to_write = ["run", "VERSION"]

    if missing_path is not None:
        paths_to_write.remove(missing_path)

    for path in paths_to_write:
        tmpdir.join(path).write("foobar")

    if missing_client != "dir":
        client_dir = tmpdir.mkdir("client")

        client_files_to_write = ["app.foobar.js", "favicon.ico", "index.html"]

        if missing_client is not None:
            client_files_to_write.remove(missing_client)

        for filename in client_files_to_write:
            client_dir.join(filename).write("foobar")

    result = virtool.updates.check_tree(str(tmpdir))

    assert result == (p_result and c_result)


async def test_copy_software_files(tmpdir):
    tar_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")

    temp_path = str(tmpdir)

    shutil.copy(tar_path, temp_path)

    decomp_path = os.path.join(temp_path, "decomp")

    with tarfile.open(os.path.join(temp_path, "virtool.tar.gz"), "r:gz") as handle:
        handle.extractall(decomp_path)

    dest_dir = tmpdir.mkdir("dest")

    f = dest_dir.mkdir("client").join("test.txt")
    f.write("foobar")

    for filename in ["VERSION", "run"]:
        dest_dir.join(filename).write("foobar")

    dest_path = str(dest_dir)

    virtool.updates.copy_software_files(os.path.join(decomp_path, "virtool"), dest_path)

    assert set(os.listdir(dest_path)) == {"run", "client", "VERSION", "install.sh"}

    assert set(os.listdir(os.path.join(dest_path, "client"))) == {
        "app.a006b17bf13ea9cb7827.js",
        "favicon.ico",
        "index.html"
    }

    assert os.path.getsize(os.path.join(dest_path, "run")) == 43957176

    assert tmpdir.join("dest").join("VERSION").read() == "v1.7.5"






