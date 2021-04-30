import concurrent.futures
import pytest
import subprocess

import virtool.version


@pytest.mark.parametrize("source", [None, "git", "file"])
async def test_find_server_version(source, loop, mocker, tmp_path):
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

    if source == "git":
        assert await virtool.version.determine_server_version(tmp_path) == "1.0.13"
    elif source == "file":
        tmp_path.joinpath("VERSION").write_text("1.0.12")

        assert await virtool.version.determine_server_version(tmp_path) == "1.0.12"

    else:
        assert await virtool.version.determine_server_version(tmp_path) == "Unknown"
