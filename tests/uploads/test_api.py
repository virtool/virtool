import os
import sys
from pathlib import Path

import pytest

from virtool.uploads.api import UPLOAD_TYPES
from virtool.uploads.models import Upload


@pytest.fixture
def files(tmpdir):
    tmpdir.mkdir("files")

    path = Path(sys.path[0]) / "tests" / "test_files" / "test.fq.gz"

    files = {
        "file": open(path, "rb")
    }

    return files


class TestUpload:

    @pytest.mark.parametrize("upload_type", UPLOAD_TYPES)
    async def test(self, files, upload_type, tmpdir, snapshot, spawn_client, static_time):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        client.app["settings"]["data_path"] = str(tmpdir)

        if upload_type:
            resp = await client.post_form(f"/api/uploads?type={upload_type}&name=Test.fq.gz", data=files)
        else:
            resp = await client.post_form("/api/uploads?name=Test.fq.gz", data=files)

        assert resp.status == 201

        assert os.listdir(tmpdir / "files") == ["1-Test.fq.gz"]

        snapshot.assert_match(await resp.json())

    async def test_invalid_query(self, files, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        resp = await client.post_form("/api/uploads", data=files)

        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })

    async def test_bad_type(self, files, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

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

        snapshot.assert_match(await resp.json())


class TestGet:
    @pytest.mark.parametrize("exists", [True, False])
    async def test(self, exists, files, resp_is, spawn_client, tmpdir):
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        if exists:
            await client.post_form("/api/uploads?name=test.fq.gz", data=files)

        resp = await client.get("/api/uploads/1")

        if exists:
            assert resp.status == 200
        else:
            assert await resp_is.not_found(resp, message="Upload record not found")

    @pytest.mark.parametrize("exists", [True, False])
    async def test_upload_removed(self, exists, resp_is, spawn_client, pg_session, tmpdir):
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        async with pg_session as session:
            if exists:
                session.add(Upload(name_on_disk="1-test.fq.gz", removed=False))
            else:
                session.add(Upload(name_on_disk="1-test.fq.gz", removed=True))

            await session.commit()

        resp = await client.get("/api/uploads/1")

        if exists:
            assert await resp_is.not_found(resp, message="Uploaded file not found at expected location")
        else:
            assert await resp_is.not_found(resp, message="Uploaded file has already been removed")


class TestDelete:
    async def test(self, files, spawn_client, snapshot, tmpdir):
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        await client.post_form("/api/uploads?name=test.fq.gz", data=files)

        resp = await client.delete("/api/uploads/1")
        assert resp.status == 204

        resp = await client.get("api/uploads/1")
        assert resp.status == 404

    @pytest.mark.parametrize("removed", [True, False])
    async def test_already_removed(self, removed, spawn_client, tmpdir, pg_session):
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        async with pg_session as session:
            if removed:
                session.add(Upload(name_on_disk="1-test.fq.gz", removed=True))
            else:
                session.add(Upload(name_on_disk="1-test.fq.gz", removed=False))

            await session.commit()

        resp = await client.delete("/api/uploads/1")

        if removed:
            assert resp.status == 400
        else:
            assert resp.status == 404

    @pytest.mark.parametrize("exists", [True, False])
    async def test_record_dne(self, exists, spawn_client, pg_session):
        client = await spawn_client(authorize=True, administrator=True)

        if exists:
            async with pg_session as session:
                session.add(Upload(name_on_disk="1-test.fq.gz", removed=True))
                await session.commit()

        resp = await client.delete("/api/uploads/1")

        if exists:
            assert resp.status == 400
        else:
            assert resp.status == 404
