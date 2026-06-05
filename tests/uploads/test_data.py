from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.pg.utils import get_row_by_id
from virtool.samples.sql import SQLSampleReads
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
from virtool.utils import timestamp


async def _backdate(pg: AsyncEngine, upload_id: int, age: timedelta) -> None:
    """Set an upload's ``created_at`` to ``age`` in the past."""
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLUpload)
            .where(SQLUpload.id == upload_id)
            .values(created_at=timestamp() - age),
        )
        await session.commit()


async def _is_stored(storage: StorageBackend, pg: AsyncEngine, upload_id: int) -> bool:
    """Check whether an upload's file is still present in storage."""
    row = await get_row_by_id(pg, SQLUpload, upload_id)
    key = upload_file_key(row.name_on_disk)
    async for info in storage.list(key):
        if info.key == key:
            return True
    return False


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


THRESHOLD = timedelta(days=30)
OLDER_THAN_THRESHOLD = timedelta(days=31)


async def _link_to_sample(pg: AsyncEngine, upload_id: int, sample_id: str) -> None:
    """Create a ``SQLSampleReads`` row linking an upload to a sample."""
    async with AsyncSession(pg) as session:
        session.add(
            SQLSampleReads(
                sample=sample_id,
                name="reads_1.fq.gz",
                name_on_disk="reads_1.fq.gz",
                size=1,
                upload=upload_id,
                uploaded_at=timestamp(),
            ),
        )
        await session.commit()


class TestReapOrphaned:
    """Reaping of reserved uploads that were never linked to a sample."""

    async def test_reaps_old_unlinked_reserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """An old, reserved, unlinked upload is deleted and its file removed."""
        orphan = await fake.uploads.create(
            user=await fake.users.create(), reserved=True
        )
        await _backdate(pg, orphan.id, OLDER_THAN_THRESHOLD)

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 1

        row = await get_row_by_id(pg, SQLUpload, orphan.id)
        assert row.removed is True
        assert row.removed_at is not None
        assert not await _is_stored(memory_storage, pg, orphan.id)

    async def test_skips_young_reserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """A reserved upload younger than the threshold is left in place.

        This protects reservations made during an in-flight sample creation, before
        their reads link is written.
        """
        young = await fake.uploads.create(user=await fake.users.create(), reserved=True)

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 0

        row = await get_row_by_id(pg, SQLUpload, young.id)
        assert row.removed is False
        assert await _is_stored(memory_storage, pg, young.id)

    async def test_skips_linked(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """A reserved upload linked to a sample is left in place."""
        linked = await fake.uploads.create(
            user=await fake.users.create(), reserved=True
        )
        await _backdate(pg, linked.id, OLDER_THAN_THRESHOLD)
        await _link_to_sample(pg, linked.id, "owning_sample")

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 0

        row = await get_row_by_id(pg, SQLUpload, linked.id)
        assert row.removed is False
        assert await _is_stored(memory_storage, pg, linked.id)

    async def test_skips_unreserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """An unreserved upload is never reaped, even when old and unlinked."""
        released = await fake.uploads.create(user=await fake.users.create())
        await _backdate(pg, released.id, OLDER_THAN_THRESHOLD)

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 0

        row = await get_row_by_id(pg, SQLUpload, released.id)
        assert row.removed is False
        assert await _is_stored(memory_storage, pg, released.id)

    async def test_skips_already_removed(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """An already-removed upload is not reaped a second time."""
        removed = await fake.uploads.create(
            user=await fake.users.create(), reserved=True
        )
        await _backdate(pg, removed.id, OLDER_THAN_THRESHOLD)
        await data_layer.uploads.delete(removed.id)

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 0

    async def test_reaps_only_eligible(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """Only old, reserved, unlinked uploads are reaped from a mixed set."""
        user = await fake.users.create()

        orphan = await fake.uploads.create(user=user, reserved=True)
        young = await fake.uploads.create(user=user, reserved=True)
        linked = await fake.uploads.create(user=user, reserved=True)
        released = await fake.uploads.create(user=user)

        await _backdate(pg, orphan.id, OLDER_THAN_THRESHOLD)
        await _backdate(pg, linked.id, OLDER_THAN_THRESHOLD)
        await _backdate(pg, released.id, OLDER_THAN_THRESHOLD)
        await _link_to_sample(pg, linked.id, "owning_sample")

        assert await data_layer.uploads.reap_orphaned(THRESHOLD) == 1

        assert (await get_row_by_id(pg, SQLUpload, orphan.id)).removed is True

        for survivor in (young, linked, released):
            assert (await get_row_by_id(pg, SQLUpload, survivor.id)).removed is False
            assert await _is_stored(memory_storage, pg, survivor.id)
