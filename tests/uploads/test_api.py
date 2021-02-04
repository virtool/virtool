import os
import sys
from pathlib import Path

import pytest

from virtool.uploads.api import UPLOAD_TYPES
from virtool.uploads.models import Upload


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


class TestFind:
    @pytest.fixture
    async def prepare_db(self, pg_session, static_time):
        upload_1 = Upload(id=1, name="test.fq.gz", type="reads", user="danny")
        upload_2 = Upload(id=2, name="test.fq.gz", type="subtraction", user="lester")
        upload_3 = Upload(id=3, name="test.fq.gz", user="jake")

        async with pg_session as session:
            session.add_all([upload_1, upload_2, upload_3])

            await session.commit()

    @pytest.mark.parametrize("type_", ["reads", "reference", None])
    @pytest.mark.parametrize("user", ["danny", "lester", "jake"])
    async def test(self, spawn_client, resp_is, snapshot, type_, user, prepare_db):
        client = await spawn_client(authorize=True, administrator=True)

        if type_:
            resp = await client.get(f"/api/uploads?type={type_}&user={user}")
        else:
            resp = await client.get(f"/api/uploads?user={user}")

            assert resp.status == 200

        assert resp.status == 200

        snapshot.assert_match(await resp.json())
