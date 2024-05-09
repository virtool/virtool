import pytest

import virtool.version


@pytest.mark.parametrize("source", [None,  "file"])
async def test_find_server_version(source, tmp_path):
    if source == "file":
        tmp_path.joinpath("VERSION").write_text("1.0.12")

        assert await virtool.version.determine_server_version(tmp_path) == "1.0.12"

    else:
        assert await virtool.version.determine_server_version(tmp_path) == "Unknown"
