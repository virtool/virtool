import datetime
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.pg.utils import get_row_by_id
from virtool.uploads.models import SQLUpload, UploadType


async def test_create(
    data_path: Path,
    data_layer: DataLayer,
    example_path: Path,
        fake: DataFaker,
    pg: AsyncEngine,
    snapshot,
):
    user = await fake.users.create()

    fake_file_path = example_path / "reads/single.fq.gz"

    upload = await data_layer.uploads.create(
        fake_file_chunker(fake_file_path),
        "sample_1.fq.gz",
        UploadType.reads,
        user=user.id,
    )

    assert upload == snapshot(
        name="obj",
        matcher=path_type(
            {"created_at": (datetime.datetime,), "uploaded_at": (datetime.datetime,)},
        ),
    )

    assert (await get_row_by_id(pg, SQLUpload, upload.id)).to_dict() == snapshot(
        name="sql",
        matcher=path_type(
            {"created_at": (datetime.datetime,), "uploaded_at": (datetime.datetime,)},
        ),
    )

    assert (
        open(data_path / "files" / upload.name_on_disk, "rb").read()
        == open(fake_file_path, "rb").read()
    )


async def test_delete(
    data_path: Path,
    data_layer: DataLayer,
        fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
):
    before = await fake.uploads.create(user=await fake.users.create())

    path = data_path / "files" / before.name_on_disk

    assert path.is_file()

    assert before.removed_at is None

    after = await data_layer.uploads.delete(before.id)

    assert after == snapshot_recent(
        name="after",
    )

    assert not path.is_file()

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
