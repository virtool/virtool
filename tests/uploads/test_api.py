from pathlib import Path

import pytest
from aiohttp import ClientResponse
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.models.enums import Permission
from virtool.uploads.sql import UploadType


@pytest.fixture()
def upload_request_form(example_path: Path):
    return {
        "file": open(example_path / "reads/single.fq.gz", "rb"),
    }


class TestUpload:
    async def test(
        self,
        upload_request_form,
        tmp_path,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test `POST /uploads` to assure a file can be uploaded."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.upload_file],
        )

        resp = await client.post_form(
            "/uploads?name=single.fq.gz&type=reads",
            data=upload_request_form,
        )

        assert resp.status == 201
        print(await resp.json())
        assert await resp.json() == snapshot_recent()

    async def test_no_upload_type(
        self,
        upload_request_form,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        """Test that not supplying ``type`` in the query string leads to a ``400``."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.upload_file],
        )

        resp = await client.post_form(
            "/uploads?name=single.fq.gz",
            data=upload_request_form,
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_bad_upload_type(
        self,
        spawn_client: ClientSpawner,
        upload_request_form,
    ):
        """Test that supplying a bad ``type`` in the query string leads to a ``400``."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.upload_file],
        )

        resp = await client.post_form(
            "/uploads?name=Test.fq.gz&type=bad",
            data=upload_request_form,
        )

        assert resp.status == 400
        assert await resp.json() == [
            {
                "ctx": {
                    "enum_values": ["hmm", "reference", "reads", "subtraction"],
                },
                "in": "query string",
                "loc": ["type"],
                "msg": (
                    "value is not a valid enumeration member; permitted: 'hmm', "
                    "'reference', 'reads', 'subtraction'"
                ),
                "type": "type_error.enum",
            },
        ]


class TestFind:
    @pytest.mark.parametrize(
        "upload_type",
        [UploadType.reads, UploadType.reference, None],
    )
    async def test(
        self,
        upload_type: UploadType | None,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        snapshot,
        static_time,
    ):
        """Test `GET /uploads` to assure that it returns the correct `upload` documents."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await fake.uploads.create(user=user)
        await fake.uploads.create(user=user, upload_type=UploadType.reference)
        await fake.uploads.create(user=user, upload_type=UploadType.subtraction)

        url = "/uploads"

        if upload_type:
            url += f"?upload_type={upload_type.value}"

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
        fake: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake.users.create()

        await fake.uploads.create(user=user)
        await fake.uploads.create(user=user, reserved=True)
        await fake.uploads.create(user=user, upload_type=UploadType.reference)
        await fake.uploads.create(user=user, upload_type=UploadType.subtraction)

        url = "/uploads?paginate=true"

        if per_page is not None:
            url = f"{url}&per_page={per_page}"

        if page is not None:
            url = f"{url}&page={page}"

        resp = await client.get(url)

        assert resp.status == 200
        assert await resp.json() == snapshot


async def test_get(
    example_path: Path,
    fake: DataFaker,
    spawn_client: ClientSpawner,
):
    """Test `GET /uploads/:id` to assure that it lets you download a file."""
    client = await spawn_client(authenticated=True)

    upload = await fake.uploads.create(user=await fake.users.create())

    resp: ClientResponse = await client.get(f"/uploads/{upload.id}")

    assert resp.status == 200
    assert await resp.read() == open(example_path / "reads/single.fq.gz", "rb").read()


async def test_delete(fake: DataFaker, resp_is, spawn_client: ClientSpawner):
    """Test `DELETE /uploads/:id to assure that it properly deletes an existing
    `uploads` row and file.

    """
    client = await spawn_client(authenticated=True, administrator=True)

    upload = await fake.uploads.create(user=await fake.users.create())

    resp = await client.delete(f"/uploads/{upload.id}")
    await resp_is.no_content(resp)

    resp = await client.get("api/uploads/1")
    assert resp.status == 404
