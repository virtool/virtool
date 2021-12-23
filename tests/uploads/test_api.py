import os
from pathlib import Path

import pytest
from virtool.uploads.models import Upload, UploadType


@pytest.fixture
def files(tmp_path):
    (tmp_path / "files").mkdir()

    path = Path.cwd() / "tests" / "test_files" / "test.fq.gz"

    files = {"file": open(path, "rb")}

    return files


class TestUpload:
    @pytest.mark.parametrize("upload_type", UploadType.to_list())
    async def test(
        self,
        files,
        upload_type,
        tmp_path,
        snapshot,
        spawn_client,
        static_time,
        pg_session,
    ):
        """
        Test `POST /uploads` to assure a file can be uploaded and that it properly updates the db.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        client.app["config"].data_path = tmp_path

        if upload_type:
            resp = await client.post_form(
                f"/uploads?type={upload_type}&name=Test.fq.gz", data=files
            )
        else:
            resp = await client.post_form("/uploads?name=Test.fq.gz", data=files)

        assert resp.status == 201
        assert await resp.json() == snapshot

        assert os.listdir(tmp_path / "files") == ["1-Test.fq.gz"]

    async def test_invalid_request(self, files, spawn_client, resp_is):
        """
        Test `POST /uploads` to assure it properly rejects an invalid request.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        resp = await client.post_form("/uploads", data=files)

        await resp_is.invalid_query(resp, {"name": ["required field"]})

    async def test_bad_type(self, files, spawn_client, resp_is):
        """
        Test `POST /uploads` to assure it properly rejects an invalid upload type.

        """
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        resp = await client.post_form(
            "/uploads?type=foobar&name=Test.fq.gz", data=files
        )

        await resp_is.bad_request(resp, "Unsupported upload type")


class TestFind:
    @pytest.mark.parametrize("upload_type", ["reads", "reference", None])
    async def test(self, upload_type, spawn_client, snapshot, test_uploads):
        """
        Test `GET /uploads` to assure that it returns the correct `upload` documents.

        """
        client = await spawn_client(authorize=True, administrator=True)

        url = f"/uploads"

        if upload_type:
            url += f"?type={upload_type}"

        resp = await client.get(url)

        assert resp.status == 200
        assert await resp.json() == snapshot


class TestGet:
    @pytest.mark.parametrize("exists", [True, False])
    async def test(self, exists, files, resp_is, spawn_client, tmp_path):
        """
        Test `GET /uploads/:id` to assure that it lets you download a file.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["config"].data_path = tmp_path

        if exists:
            await client.post_form("/uploads?name=test.fq.gz", data=files)

        resp = await client.get("/uploads/1")

        if exists:
            assert resp.status == 200
        else:
            assert resp.status == 404

    @pytest.mark.parametrize("exists", [True, False])
    async def test_upload_removed(
        self, exists, resp_is, spawn_client, pg_session, tmp_path
    ):
        """
        Test `GET /uploads/:id` to assure that it doesn't let you download a file that has been removed.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["config"].data_path = tmp_path

        async with pg_session as session:
            session.add(Upload(name_on_disk="1-test.fq.gz", removed=exists))
            await session.commit()

        resp = await client.get("/uploads/1")

        assert resp.status == 404


class TestDelete:
    async def test(self, files, spawn_client, tmp_path, resp_is):
        """
        Test `DELETE /uploads/:id to assure that it properly deletes an existing `uploads` row and file.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["config"].data_path = tmp_path
        await client.post_form("/uploads?name=test.fq.gz", data=files)

        resp = await client.delete("/uploads/1")
        await resp_is.no_content(resp)

        resp = await client.get("api/uploads/1")
        assert resp.status == 404

    @pytest.mark.parametrize("exists", [True, False])
    async def test_already_removed(
        self, exists, spawn_client, tmp_path, pg_session, resp_is
    ):
        """
        Test `DELETE /uploads/:id to assure that it doesn't try to delete a file that has already been removed.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["config"].data_path = tmp_path

        async with pg_session as session:
            session.add(Upload(name_on_disk="1-test.fq.gz", removed=exists))

            await session.commit()

        resp = await client.delete("/uploads/1")

        if exists:
            assert resp.status == 404
        else:
            await resp_is.no_content(resp)

    @pytest.mark.parametrize("exists", [True, False])
    async def test_record_dne(
        self, exists, spawn_client, pg_session, tmp_path, resp_is
    ):
        """
        Test `DELETE /uploads/:id to assure that it doesn't try to delete a file that corresponds to a `upload`
        record that does not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        client.app["config"].data_path = tmp_path

        if exists:
            async with pg_session as session:
                session.add(Upload(name_on_disk="1-test.fq.gz"))
                await session.commit()

        resp = await client.delete("/uploads/1")

        if exists:
            await resp_is.no_content(resp)
        else:
            assert resp.status == 404
