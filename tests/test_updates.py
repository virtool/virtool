import os
import sys
import shutil
import pytest
import tarfile
import aiohttp

import virtool.errors
import virtool.updates


@pytest.fixture
def mock_release():
    return {
        "url": "https://api.github.com/repos/virtool/virtool/releases/5864133",
        "assets_url": "https://api.github.com/repos/virtool/virtool/releases/5864133/assets",
        "upload_url": "https://uploads.github.com/repos/virtool/virtool/releases/5864133/assets{?name,label}",
        "html_url": "https://github.com/virtool/virtool/releases/tag/v1.8.5",
        "id": 5864133,
        "tag_name": "v1.8.5",
        "target_commitish": "master",
        "name": "v1.8.5",
        "draft": False,
        "author": {
            "login": "igboyes",
            "id": 5943558,
            "avatar_url": "https://avatars1.githubusercontent.com/u/5943558?v=4",
            "gravatar_id": "",
            "url": "https://api.github.com/users/igboyes",
            "html_url": "https://github.com/igboyes",
            "followers_url": "https://api.github.com/users/igboyes/followers",
            "following_url": "https://api.github.com/users/igboyes/following{/other_user}",
            "gists_url": "https://api.github.com/users/igboyes/gists{/gist_id}",
            "starred_url": "https://api.github.com/users/igboyes/starred{/owner}{/repo}",
            "subscriptions_url": "https://api.github.com/users/igboyes/subscriptions",
            "organizations_url": "https://api.github.com/users/igboyes/orgs",
            "repos_url": "https://api.github.com/users/igboyes/repos",
            "events_url": "https://api.github.com/users/igboyes/events{/privacy}",
            "received_events_url": "https://api.github.com/users/igboyes/received_events",
            "type": "User",
            "site_admin": False
        },
        "prerelease": False,
        "created_at": "2017-03-24T20:52:23Z",
        "published_at": "2017-03-24T21:03:18Z",
        "assets": [
            {
                "url": "https://api.github.com/repos/virtool/virtool/releases/assets/3483395",
                "id": 3483395,
                "name": "virtool.tar.gz",
                "label": "",
                "uploader": {
                "login": "igboyes",
                "id": 5943558,
                "avatar_url": "https://avatars1.githubusercontent.com/u/5943558?v=4",
                "gravatar_id": "",
                "url": "https://api.github.com/users/igboyes",
                "html_url": "https://github.com/igboyes",
                "followers_url": "https://api.github.com/users/igboyes/followers",
                "following_url": "https://api.github.com/users/igboyes/following{/other_user}",
                "gists_url": "https://api.github.com/users/igboyes/gists{/gist_id}",
                "starred_url": "https://api.github.com/users/igboyes/starred{/owner}{/repo}",
                "subscriptions_url": "https://api.github.com/users/igboyes/subscriptions",
                "organizations_url": "https://api.github.com/users/igboyes/orgs",
                "repos_url": "https://api.github.com/users/igboyes/repos",
                "events_url": "https://api.github.com/users/igboyes/events{/privacy}",
                "received_events_url": "https://api.github.com/users/igboyes/received_events",
                "type": "User",
                "site_admin": False
            },
                "content_type": "application/gzip",
                "state": "uploaded",
                "size": 49963781,
                "download_count": 41,
                "created_at": "2017-03-24T21:08:33Z",
                "updated_at": "2017-03-24T21:08:35Z",
                "browser_download_url": "https://github.com/virtool/virtool/releases/download/v1.8.5/virtool.tar.gz"
            }
        ],
        "tarball_url": "https://api.github.com/repos/virtool/virtool/tarball/v1.8.5",
        "zipball_url": "https://api.github.com/repos/virtool/virtool/zipball/v1.8.5",
        "body": "- add software tests for `hmm.py` module\r\n- allow upload and import of `*.hmm` profile files and "
                "annotations\r\n- remove dropdown menu for checking `*hmm` files\r\n- show _none found_ message when "
                "there are no annotations\r\n- fix #90"
    }


def test_format_software_release(mock_release):
    assert virtool.updates.format_software_release(mock_release) == {
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


def test_install(mocker):
    pass


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


@pytest.mark.parametrize("error", [None, "url", "write"])
async def test_download_release(error, tmpdir, test_motor, test_dispatch):
    url = "https://github.com/linux-test-project/ltp/releases/download/20170516/ltp-full-20170516.tar.bz2"

    if error == "url":
        url = "https://github.com/virtool/virtool/releases/download/v1.8.5/foobar.tar.gz"

    size = 3664835

    path = str(tmpdir)

    target_path = os.path.join(path, "release.tar.gz")

    if error == "write":
        target_path = "/foobar/this/should/not-exist"

    await test_motor.status.insert_one({
        "_id": "software_update",
        "process": {
            "size": 34091211,
            "step": "download_release",
            "progress": 0
        }
    })

    task = virtool.updates.download_release(test_motor, test_dispatch, url, size, target_path)

    if error == "url":
        with pytest.raises(virtool.errors.GitHubError) as err:
            await task

        assert "Could not download release" in str(err)

    elif error == "write":
        with pytest.raises(FileNotFoundError):
            await task

    else:
        await task

    if error:
        assert os.listdir(path) == []
    else:
        assert os.listdir(path) == ["release.tar.gz"]

    if not error:
        assert os.path.getsize(target_path) == 3664835

        assert await test_motor.status.find_one("software_update") == {
            "_id": "software_update",
            "process": {
                "size": 34091211,
                "step": "download_release",
                "progress": 1
            }
        }


def test_decompress_file(tmpdir):
    path = str(tmpdir)

    src_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")

    shutil.copy(src_path, path)

    virtool.updates.decompress_file(os.path.join(path, "virtool.tar.gz"), os.path.join(path, "de"))

    assert os.listdir(path) == ["virtool.tar.gz", "de"]

    assert os.listdir(os.path.join(path, "de")) == ["virtool"]

    assert os.listdir(os.path.join(path, "de", "virtool")) == ["run", "client", "VERSION", "install.sh"]


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

    assert set(os.listdir(dest_path)) == {"run", "client", "VERSION"}

    assert os.listdir(os.path.join(dest_path, "client")) == [
        "app.a006b17bf13ea9cb7827.js",
        "favicon.ico",
        "index.html"
    ]

    assert os.path.getsize(os.path.join(dest_path, "run")) == 43957176

    assert tmpdir.join("dest").join("VERSION").read() == "v1.7.5"






