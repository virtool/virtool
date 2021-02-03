import os
import sys
from pathlib import Path

import pytest

from virtool.uploads.api import UPLOAD_TYPES


class TestUpload:

    @pytest.mark.parametrize("upload_type", UPLOAD_TYPES)
    async def test(self, upload_type, tmpdir, snapshot, spawn_client, static_time):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        client.app["settings"]["data_path"] = str(tmpdir)

        # This is where the file should end up.
        files_dir = tmpdir.mkdir("files")

        # This is the path to the file to be uploaded.
        path = Path(sys.path[0]) / "tests" / "test_files" / "test.fq.gz"

        files = {
            "file": open(path, "rb")
        }

        if upload_type:
            resp = await client.post_form(f"/api/uploads?type={upload_type}&name=Test.fq.gz", data=files)
        else:
            resp = await client.post_form(f"/api/uploads?name=Test.fq.gz", data=files)

        assert resp.status == 201

        assert os.listdir(str(files_dir)) == ["1-Test.fq.gz"]

        snapshot.assert_match(await resp.json())

    async def test_invalid_query(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        path = Path(sys.path[0]) / "tests" / "test_files" / "test.fq.gz"

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/api/uploads", data=files)

        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })

    async def test_bad_type(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        path = Path(sys.path[0]) / "tests" / "test_files" / "test.fq.gz"

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/api/uploads?type=foobar&name=Test.fq.gz", data=files)

        assert await resp_is.bad_request(resp, message="Unsupported upload type")
