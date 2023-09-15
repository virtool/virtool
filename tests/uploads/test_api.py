from pathlib import Path

import pytest
from aiohttp import ClientResponse
from syrupy.matchers import path_type
from virtool_core.models.enums import Permission

from tests.fixtures.client import ClientSpawner
from virtool.config import get_config_from_app
from virtool.config.cls import ServerConfig
from virtool.fake.next import DataFaker
from virtool.uploads.models import UploadType


@pytest.fixture
def upload_request_form(example_path: Path):
    return {
        "file": open(example_path / "reads/single.fq.gz", "rb"),
    }


@pytest.mark.apitest
class TestUpload:
    async def test(
        self,
        upload_request_form,
        tmp_path,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """
        Test `POST /uploads` to assure a file can be uploaded.

        """
        client = await spawn_client(
            authenticated=True, permissions=[Permission.upload_file]
        )

        resp = await client.post_form(
            "/uploads?name=single.fq.gz&type=reads",
            data=upload_request_form,
        )

        assert resp.status == 201
        assert await resp.json() == snapshot(matcher=path_type({"created_at": (str,)}))

    async def test_no_upload_type(
        self, upload_request_form, snapshot, spawn_client: ClientSpawner
    ):
        """Test that not supplying ``type`` in the query string leads to a ``400``."""
        client = await spawn_client(
            authenticated=True, permissions=[Permission.upload_file]
        )

        resp = await client.post_form(
            "/uploads?name=single.fq.gz",
            data=upload_request_form,
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_bad_upload_type(
        self, snapshot, spawn_client: ClientSpawner, upload_request_form
    ):
        """Test that supplying a bad ``type`` in the query string leads to a ``400``."""
        client = await spawn_client(
            authenticated=True, permissions=[Permission.upload_file]
        )

        resp = await client.post_form(
            "/uploads?name=Test.fq.gz&type=bad", data=upload_request_form
        )

        assert resp.status == 400
        assert await resp.json() == snapshot


@pytest.mark.apitest
class TestFind:
    @pytest.mark.parametrize(
        "upload_type", [UploadType.reads, UploadType.reference, None]
    )
    async def test(
        self,
        upload_type: UploadType | None,
        fake2: DataFaker,
        spawn_client: ClientSpawner,
        snapshot,
        static_time,
    ):
        """
        Test `GET /uploads` to assure that it returns the correct `upload` documents.

        """
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()

        await fake2.uploads.create(user=user)
        await fake2.uploads.create(user=user, upload_type=UploadType.reference)
        await fake2.uploads.create(user=user, upload_type=UploadType.subtraction)

        url = "/uploads"

        if upload_type:
            url += f"?upload_type={upload_type}"

        resp = await client.get(url)

        assert resp.status == 200
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(
        "per_page,page",
        [
            (None, None),
            (1, None),
            (1, 2),
            (2, None),
            (3, 1),
            (None, 2),
        ],
    )
    async def test_pagination(
        self,
        page: int | None,
        per_page: int | None,
        fake2: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake2.users.create()

        await fake2.uploads.create(user=user)
        await fake2.uploads.create(user=user, reserved=True)
        await fake2.uploads.create(user=user, upload_type=UploadType.reference)
        await fake2.uploads.create(user=user, upload_type=UploadType.subtraction)

        url = "/uploads?paginate=true"

        if per_page is not None:
            url = f"{url}&per_page={per_page}"

        if page is not None:
            url = f"{url}&page={page}"

        resp = await client.get(url)

        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_get(
    config: ServerConfig,
    example_path: Path,
    fake2: DataFaker,
    spawn_client: ClientSpawner,
):
    """
    Test `GET /uploads/:id` to assure that it lets you download a file.

    """
    client = await spawn_client(authenticated=True)
    get_config_from_app(client.app).data_path = config.data_path

    upload = await fake2.uploads.create(user=await fake2.users.create())

    resp: ClientResponse = await client.get(f"/uploads/{upload.id}")

    assert resp.status == 200
    assert await resp.read() == open(example_path / "reads/single.fq.gz", "rb").read()


@pytest.mark.apitest
async def test_delete(fake2: DataFaker, resp_is, spawn_client: ClientSpawner):
    """
    Test `DELETE /uploads/:id to assure that it properly deletes an existing
    `uploads` row and file.

    """
    client = await spawn_client(authenticated=True, administrator=True)

    upload = await fake2.uploads.create(user=await fake2.users.create())

    resp = await client.delete(f"/uploads/{upload.id}")
    await resp_is.no_content(resp)

    resp = await client.get("api/uploads/1")
    assert resp.status == 404
