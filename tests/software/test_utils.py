import os
import sys
import shutil
import pytest
import tarfile

import virtool.errors
import virtool.software.utils


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

    result = virtool.software.utils.check_software_files(str(tmpdir))

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

    virtool.software.utils.copy_software_files(os.path.join(decomp_path, "virtool"), dest_path)

    assert set(os.listdir(dest_path)) == {"run", "client", "VERSION", "install.sh"}

    assert set(os.listdir(os.path.join(dest_path, "client"))) == {
        "app.a006b17bf13ea9cb7827.js",
        "favicon.ico",
        "index.html"
    }

    assert os.path.getsize(os.path.join(dest_path, "run")) == 43957176

    assert tmpdir.join("dest").join("VERSION").read() == "v1.7.5"






