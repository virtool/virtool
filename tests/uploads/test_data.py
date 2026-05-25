from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.pg.utils import get_row_by_id
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key


async def test_create(
    data_layer: DataLayer,
    example_path: Path,
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
):
    user = await fake.users.create()

    fake_file_path = example_path / "sample" / "reads_1.fq.gz"

    upload = await data_layer.uploads.create(
        fake_file_chunker(fake_file_path),
        "sample_1.fq.gz",
        UploadType.reads,
        user_id=user.id,
    )

    assert upload.name == "sample_1.fq.gz"
    assert upload.ready is True
    assert upload.removed is False
    assert upload.size == 723988
    assert upload.type == "reads"
    assert upload.user.id == user.id

    row = await get_row_by_id(pg, SQLUpload, upload.id)
    assert row.name == "sample_1.fq.gz"
    assert row.name_on_disk.endswith("-sample_1.fq.gz")

    key = upload_file_key(row.name_on_disk)

    assert (
        b"".join([chunk async for chunk in memory_storage.read(key)])
        == fake_file_path.read_bytes()
    )


async def test_delete(
    data_layer: DataLayer,
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
):
    before = await fake.uploads.create(user=await fake.users.create())

    row = await get_row_by_id(pg, SQLUpload, before.id)
    key = upload_file_key(row.name_on_disk)

    found = False
    async for info in memory_storage.list(key):
        if info.key == key:
            found = True
    assert found
    assert before.removed_at is None

    after = await data_layer.uploads.delete(before.id)

    assert after.id == before.id
    assert after.name == before.name
    assert after.removed is True
    assert after.removed_at is not None

    found = False
    async for info in memory_storage.list(key):
        if info.key == key:
            found = True
    assert not found

    with pytest.raises(ResourceNotFoundError):
        await data_layer.uploads.get(before.id)

    with pytest.raises(ResourceNotFoundError):
        await data_layer.uploads.delete(before.id)


@pytest.mark.parametrize("multi", [True, False])
async def test_release(
    multi: bool,
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
):
    user = await fake.users.create()

    upload_1 = await fake.uploads.create(user=user, reserved=True)
    upload_2 = await fake.uploads.create(user=user, reserved=True)
    upload_3 = await fake.uploads.create(user=user, reserved=True)

    assert all([upload_1.reserved, upload_2.reserved, upload_3.reserved])

    assert (
        await data_layer.uploads.release(
            [upload_1.id, upload_3.id] if multi else upload_2.id,
        )
        is None
    )

    async with AsyncSession(pg) as session:
        result = await session.execute(select(SQLUpload).order_by(SQLUpload.id))
        reserved = [u.reserved for u in result.unique().scalars().all()]

    assert reserved == [False, True, False] if multi else [True, False, True]
