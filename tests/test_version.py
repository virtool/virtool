import concurrent.futures
import os
import pytest
import subprocess

import virtool.version


@pytest.mark.parametrize("source", [None, "git", "file"])
async def test_find_server_version(source, loop, mocker, tmpdir):
    if source == "git":
        mocker.patch(
            "subprocess.check_output",
            return_value=bytes("1.0.13", encoding="utf-8")
        )
    else:
        mocker.patch(
            "subprocess.check_output",
            side_effect=subprocess.CalledProcessError(1, "none")
        )

    loop.set_default_executor(concurrent.futures.ThreadPoolExecutor())

    tmpdir.join("VERSION")

    if source == "git":
        assert await virtool.version.determine_server_version(str(tmpdir)) == "1.0.13"

    elif source == "file":
        with open(os.path.join(str(tmpdir), "VERSION"), "w") as handle:
            handle.write("1.0.12")

        assert await virtool.version.determine_server_version(str(tmpdir)) == "1.0.12"

    else:
        assert await virtool.version.determine_server_version(str(tmpdir)) == "Unknown"
