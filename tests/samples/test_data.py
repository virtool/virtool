from pathlib import Path

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.analysis import seed_analysis
from virtool.analyses.sql import SQLAnalysis
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.data import SamplesData
from virtool.samples.db import AttachUploadsTransform
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleReads,
    SQLSampleUpload,
)
from virtool.settings.oas import UpdateSettingsRequest
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload
from virtool.users.oas import UpdateUserRequest
from virtool.utils import timestamp

QUALITY = {
    "bases": [[1543]],
    "composition": [[6372]],
    "count": 7069,
    "encoding": "OuBQPPuwYimrxkNpPWUx",
    "gc": 34222440,
    "length": [3237],
    "sequences": [7091],
}


async def _count_legacy_samples(pg: AsyncEngine) -> int:
    async with AsyncSession(pg) as session:
        return len((await session.execute(select(SQLLegacySample.id))).scalars().all())


class TestCreate:
    @pytest.mark.parametrize(
        "group_setting",
        ["none", "users_primary_group", "force_choice"],
    )
    async def test_ok(
        self,
        group_setting: str,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot_recent,
    ):
        actor = await fake.users.create()

        group = await fake.groups.create()

        await data_layer.settings.update(
            UpdateSettingsRequest(
                sample_group=group_setting,
                sample_all_write=True,
                sample_group_write=True,
            ),
        )
        await data_layer.users.update(
            actor.id,
            UpdateUserRequest(groups=[*[g.id for g in actor.groups], group.id]),
        )

        await data_layer.users.update(
            actor.id,
            UpdateUserRequest(primary_group=group.id),
        )

        label = await fake.labels.create()
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        data = {
            "files": [upload.id],
            "labels": [label.id],
            "name": "Foobar",
            "subtractions": [apple.id],
        }

        if group_setting == "force_choice":
            data["group"] = group.id

        sample = await data_layer.samples.create(
            CreateSampleRequest(**data),
            actor.id,
        )

        assert sample == snapshot_recent(name="sample")
        assert (await get_row_by_id(pg, SQLUpload, 1)).reserved is True

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
                    ),
                )
            ).scalar_one()

            label_ids = (
                (
                    await session.execute(
                        select(SQLLegacySampleLabel.label_id).where(
                            SQLLegacySampleLabel.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

            subtraction_ids = (
                (
                    await session.execute(
                        select(SQLLegacySampleSubtraction.subtraction_id).where(
                            SQLLegacySampleSubtraction.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

            sample_uploads = (
                (
                    await session.execute(
                        select(SQLSampleUpload)
                        .where(SQLSampleUpload.sample_id == legacy.id)
                        .order_by(SQLSampleUpload.index),
                    )
                )
                .scalars()
                .all()
            )

        assert [(row.sample, row.upload_id, row.index) for row in sample_uploads] == [
            (str(legacy.id), upload.id, 0),
        ]

        # Samples created natively in Postgres have no Mongo id to carry.
        assert legacy.legacy_id is None

        assert legacy.name == "Foobar"
        assert legacy.library_type == sample.library_type
        assert legacy.user_id == actor.id
        assert legacy.job_id == sample.job.id
        assert legacy.ready is False
        assert legacy.hold is True
        assert legacy.all_read is True
        assert legacy.all_write is True
        assert legacy.group_read is True
        assert legacy.group_write is True
        assert legacy.group_id == (None if group_setting == "none" else group.id)
        assert set(label_ids) == {label.id}
        assert set(subtraction_ids) == {apple.id}

    async def test_already_reserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A reserved file cannot be used to create a sample."""
        actor = await fake.users.create()

        upload = await fake.uploads.create(
            user=await fake.users.create(),
            reserved=True,
        )

        with pytest.raises(ResourceConflictError, match=r"File is already reserved"):
            await data_layer.samples.create(
                CreateSampleRequest(files=[upload.id], name="Foobar"),
                actor.id,
            )

        assert await _count_legacy_samples(pg) == 0

    async def test_reservation_rolled_back_on_failure(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        pg: AsyncEngine,
    ):
        """A failed sample insert leaves no reserved upload and no sample behind."""
        actor = await fake.users.create()

        upload = await fake.uploads.create(user=await fake.users.create())

        mocker.patch.object(
            SamplesData,
            "_add_legacy_sample_join_rows",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError, match=r"boom"):
            await data_layer.samples.create(
                CreateSampleRequest(files=[upload.id], name="Foobar"),
                actor.id,
            )

        row = await get_row_by_id(pg, SQLUpload, upload.id)
        assert row.reserved is False
        assert await _count_legacy_samples(pg) == 0


class TestAttachUploadsTransform:
    """The uploads array is sourced from ``sample_uploads``, ordered by ``index``."""

    async def test_orders_one_by_index(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A sample's uploads come back in the order they were supplied at creation."""
        user = await fake.users.create()
        first = await fake.uploads.create(user=user, name="first.fq.gz")
        second = await fake.uploads.create(user=user, name="second.fq.gz")

        sample = await fake.samples.create(user, uploads=[second, first])

        document = await apply_transforms(
            {"id": sample.id},
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert [upload["id"] for upload in document["uploads"]] == [
            second.id,
            first.id,
        ]

    async def test_orders_many_by_index(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The batched path groups uploads by sample and preserves index order."""
        user = await fake.users.create()
        first = await fake.uploads.create(user=user, name="first.fq.gz")
        second = await fake.uploads.create(user=user, name="second.fq.gz")
        third = await fake.uploads.create(user=user, name="third.fq.gz")

        paired = await fake.samples.create(user, uploads=[second, first])
        single = await fake.samples.create(user, uploads=[third])

        documents = await apply_transforms(
            [{"id": paired.id}, {"id": single.id}],
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert [
            [upload["id"] for upload in document["uploads"]] for document in documents
        ] == [[second.id, first.id], [third.id]]

    async def test_no_uploads_is_none(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A sample with no ``sample_uploads`` rows gets ``None``, not an empty list.

        Samples imported from Mongo without an ``uploads`` array are left without
        membership rows by the backfill, so this state outlives the migration.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user)

        async with AsyncSession(pg) as session:
            await session.execute(
                delete(SQLSampleUpload).where(SQLSampleUpload.sample_id == sample.id),
            )
            await session.commit()

        document = await apply_transforms(
            {"id": sample.id},
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert document["uploads"] is None


class TestFinalize:
    async def test_ok(
        self,
        data_layer: DataLayer,
        example_path: Path,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Finalizing a sample whose reads have been uploaded marks it ready, leaves the
        reads downloadable, and deletes the input uploads from storage.

        The upload cleanup keys off the sample's ``uploads`` array rather than its
        ``SQLSampleReads`` rows, so it does not depend on the workflow having linked the
        reads it wrote back to an upload.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True)

        upload_keys = []

        for upload in sample.uploads:
            row = await get_row_by_id(pg, SQLUpload, upload.id)
            key = row.storage_key

            assert await memory_storage.size(key) > 0

            upload_keys.append(key)

        filenames = ["reads_1.fq.gz", "reads_2.fq.gz"]

        for filename in filenames:
            await data_layer.samples.upload_reads(
                sample.id,
                filename,
                fake_file_chunker(example_path / "sample" / filename),
            )

        finalized = await data_layer.samples.finalize(sample.id, QUALITY)

        assert finalized.ready is True
        assert finalized.quality == QUALITY
        assert finalized.dict() == snapshot_recent()

        for filename in filenames:
            stream, _, _ = await data_layer.samples.get_reads_file(sample.id, filename)

            assert (
                b"".join([chunk async for chunk in stream])
                == (example_path / "sample" / filename).read_bytes()
            )

        for key in upload_keys:
            with pytest.raises(StorageKeyNotFoundError):
                await memory_storage.size(key)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).removed is True

    async def test_already_finalized(self, data_layer: DataLayer, fake: DataFaker):
        """A sample that is already ready cannot be finalized again."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        with pytest.raises(ResourceConflictError, match=r"Sample already finalized"):
            await data_layer.samples.finalize(sample.id, QUALITY)

    async def test_sample_disappeared(self, data_layer: DataLayer, mocker):
        """Finalizing raises ``ResourceNotFoundError`` when the sample row is gone after
        the existence check, rather than surfacing a ``NoResultFound`` 500.
        """
        mocker.patch.object(
            data_layer.samples,
            "_resolve_ids",
            return_value=(999999, "gone"),
        )

        with pytest.raises(ResourceNotFoundError):
            await data_layer.samples.finalize(999999, {})


class TestDelete:
    """Deleting a sample cascades to its analyses in both Mongo and Postgres."""

    async def test_deletes_analysis_pg_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """Deleting a sample removes its analyses' Postgres rows."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user, name="Test Reference")
        sample = await fake.samples.create(user, ready=True)

        index = await fake.indexes.create(reference, user, version=11, ready=True)

        analysis_id = await seed_analysis(
            pg,
            {
                "_id": None,
                "created_at": timestamp(),
                "index": {"id": index.id, "version": 11},
                "job": None,
                "ready": True,
                "reference": {"id": reference.id},
                "results": {"hits": []},
                "sample": {"id": sample.id},
                "subtractions": [],
                "user": {"id": user.id},
                "workflow": "nuvs",
            },
        )

        assert await get_row(pg, SQLAnalysis, ("id", analysis_id)) is not None

        await data_layer.samples.delete(sample.id)

        assert await get_row(pg, SQLAnalysis, ("id", analysis_id)) is None

    async def test_releases_reserved_uploads(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Deleting a sample releases the uploads reserved during its creation.

        The reservation is keyed on the sample's own ``uploads`` array, so the uploads
        are released even when no ``SQLSampleReads`` rows have been written yet.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).reserved is True

        await data_layer.samples.delete(sample.id)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).reserved is False

    async def test_removes_legacy_sample_and_join_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Deleting a sample removes its ``legacy_samples`` row and join rows."""
        label = await fake.labels.create()
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)
        apple = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Apple",
            upload_files=False,
            finalized=False,
        )

        sample = await data_layer.samples.create(
            CreateSampleRequest(
                files=[upload.id],
                labels=[label.id],
                name="Foobar",
                subtractions=[apple.id],
            ),
            user.id,
        )

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
                    ),
                )
            ).scalar_one()

            assert (
                await session.execute(
                    select(SQLSampleUpload).where(
                        SQLSampleUpload.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() != []

        await data_layer.samples.delete(sample.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
                    ),
                )
            ).scalar_one_or_none() is None

            assert (
                await session.execute(
                    select(SQLLegacySampleLabel).where(
                        SQLLegacySampleLabel.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

            assert (
                await session.execute(
                    select(SQLLegacySampleSubtraction).where(
                        SQLLegacySampleSubtraction.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

            assert (
                await session.execute(
                    select(SQLSampleUpload).where(
                        SQLSampleUpload.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

    async def test_postgres_native_sample_cleans_storage(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """Deleting a Postgres-native sample (no ``legacy_id``) removes its Postgres row
        and cleans up its storage prefix instead of raising ``ResourceNotFoundError``.

        The sample has no Mongo document, so the delete's success signal comes from the
        ``legacy_samples`` rowcount, not ``delete_one``'s ``deleted_count``.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True, ready=True)

        assert (await get_row_by_id(pg, SQLLegacySample, sample.id)).legacy_id is None

        prefix = f"samples/{sample.id}/"

        async with AsyncSession(pg) as session:
            reads_keys = sorted(
                (
                    await session.execute(
                        select(SQLSampleReads.storage_key).where(
                            SQLSampleReads.sample_id == sample.id,
                        ),
                    )
                ).scalars(),
            )

        assert len(reads_keys) == 2
        assert sorted([obj.key async for obj in memory_storage.list(prefix)]) == (
            reads_keys
        )

        await data_layer.samples.delete(sample.id)

        assert await get_row_by_id(pg, SQLLegacySample, sample.id) is None
        assert [obj.key async for obj in memory_storage.list(prefix)] == []
