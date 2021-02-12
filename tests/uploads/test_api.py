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


@pytest.fixture
async def prepare_db(pg_session, static_time):
    upload_1 = Upload(id=1, name="test.fq.gz", type="reads", user="danny")
    upload_2 = Upload(id=2, name="test.fq.gz", type="reference", user="lester")
    upload_3 = Upload(id=3, name="test.fq.gz", user="jake")

    async with pg_session as session:
        session.add_all([upload_1, upload_2, upload_3])

        await session.commit()


class TestUpload:

    @pytest.mark.parametrize("upload_type", UPLOAD_TYPES)
    async def test(self, files, upload_type, tmpdir, snapshot, spawn_client, static_time, pg_session):
        """
        Test `POST /api/uploads` to assure a file can be uploaded and that it properly updates the db.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        client.app["settings"]["data_path"] = str(tmpdir)

        if upload_type:
            resp = await client.post_form(f"/api/uploads?type={upload_type}&name=Test.fq.gz", data=files)
        else:
            resp = await client.post_form("/api/uploads?name=Test.fq.gz", data=files)

        assert resp.status == 201

        snapshot.assert_match(await resp.json())

        assert os.listdir(tmpdir / "files") == ["1-Test.fq.gz"]

    async def test_invalid_request(self, files, spawn_client, resp_is):
        """
        Test `POST /api/uploads` to assure it properly rejects an invalid request.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        resp = await client.post_form("/api/uploads", data=files)

        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })

    async def test_bad_type(self, files, spawn_client, resp_is):
        """
        Test `POST /api/uploads` to assure it properly rejects an invalid upload type.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        resp = await client.post_form("/api/uploads?type=foobar&name=Test.fq.gz", data=files)

        assert await resp_is.bad_request(resp, message="Unsupported upload type")


class TestFind:
    @pytest.mark.parametrize("type_", ["reads", "reference", None])
    @pytest.mark.parametrize("user", ["danny", "lester", "jake"])
    async def test(self, spawn_client, resp_is, snapshot, type_, user, prepare_db):
        """
        Test `GET /api/uploads` to assure that it returns the correct `upload` documents.

        """
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
        """
        Test `GET /api/uploads/:id` to assure that it lets you download a file.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        if exists:
            await client.post_form("/api/uploads?name=test.fq.gz", data=files)

        resp = await client.get("/api/uploads/1")

        if exists:
            assert resp.status == 200
        else:
            assert resp.status == 404

    @pytest.mark.parametrize("exists", [True, False])
    async def test_upload_removed(self, exists, resp_is, spawn_client, pg_session, tmpdir):
        """
        Test `GET /api/uploads/:id` to assure that it doesn't let you download a file that has been removed.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        async with pg_session as session:
            session.add(Upload(name_on_disk="1-test.fq.gz", removed=exists))

            await session.commit()

        resp = await client.get("/api/uploads/1")

        assert resp.status == 404


class TestDelete:
    async def test(self, files, spawn_client, snapshot, tmpdir):
        """
        Test `DELETE /api/uploads/:id to assure that it properly deletes an existing `upload` document and file.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        await client.post_form("/api/uploads?name=test.fq.gz", data=files)

        resp = await client.delete("/api/uploads/1")
        assert resp.status == 204

        resp = await client.get("api/uploads/1")
        assert resp.status == 404

    @pytest.mark.parametrize("exists", [True, False])
    async def test_already_removed(self, exists, spawn_client, tmpdir, pg_session):
        """
        Test `DELETE /api/uploads/:id to assure that it doesn't try to delete a file that has already been removed.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        async with pg_session as session:
            session.add(Upload(name_on_disk="1-test.fq.gz", removed=exists))

            await session.commit()

        resp = await client.delete("/api/uploads/1")

        if exists:
            assert resp.status == 404
        else:
            assert resp.status == 204

    @pytest.mark.parametrize("exists", [True, False])
    async def test_record_dne(self, exists, spawn_client, pg_session, tmpdir):
        """
        Test `DELETE /api/uploads/:id to assure that it doesn't try to delete a file that corresponds to a `upload`
        record that does not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["settings"]["data_path"] = str(tmpdir)

        if exists:
            async with pg_session as session:
                session.add(Upload(name_on_disk="1-test.fq.gz"))
                await session.commit()

        resp = await client.delete("/api/uploads/1")

        if exists:
            assert resp.status == 204
        else:
            assert resp.status == 404
