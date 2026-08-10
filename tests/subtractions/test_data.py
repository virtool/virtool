import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.sql import SQLLegacySample, SQLLegacySampleSubtraction
from virtool.subtractions.oas import (
    FinalizeSubtractionRequest,
    NucleotideComposition,
)
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import UploadType


async def test_finalize(
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot_recent,
):
    """A finalized subtraction is persisted to Postgres with no legacy id."""
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="malus.fa.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent(name="obj")

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLSubtraction).where(SQLSubtraction.id == subtraction.id),
            )
        ).scalar_one()

    assert row.to_dict() == snapshot_recent(name="pg")
    assert row.legacy_id is None


class TestMutations:
    """Single-subtraction mutations addressed by the integer id, persisted to
    Postgres only.
    """

    async def test_get(self, data_layer: DataLayer, fake: DataFaker):
        """``get`` returns the subtraction addressed by its integer id."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        assert await data_layer.subtractions.get(subtraction.id) == subtraction
        assert isinstance(subtraction.id, int)

    async def test_delete(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """``delete`` soft-deletes the subtraction in Postgres."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        await data_layer.subtractions.delete(subtraction.id)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.get(subtraction.id)

        async with AsyncSession(pg) as session:
            deleted = await session.scalar(
                select(SQLSubtraction.deleted).where(
                    SQLSubtraction.id == subtraction.id,
                ),
            )
        assert deleted is True

    async def test_delete_unlinks_sample_subtraction_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """``delete`` removes the sample's ``legacy_sample_subtractions`` join rows."""
        user = await fake.users.create()
        sample_upload = await fake.uploads.create(user=user)
        subtraction_upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=subtraction_upload,
        )

        sample = await data_layer.samples.create(
            CreateSampleRequest(
                files=[sample_upload.id],
                name="With Subtraction",
                subtractions=[subtraction.id],
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

            before = (
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
        assert before == [subtraction.id]

        await data_layer.subtractions.delete(subtraction.id)

        async with AsyncSession(pg) as session:
            after = (
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
        assert after == []

    async def test_finalize(self, data_layer: DataLayer, fake: DataFaker):
        """``finalize`` marks the subtraction ready."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user, upload=upload, finalized=False
        )

        finalized = await data_layer.subtractions.finalize(
            subtraction.id,
            FinalizeSubtractionRequest(
                count=1,
                gc=NucleotideComposition(**dict.fromkeys("actgn", 0.2)),
            ),
        )

        assert finalized.id == subtraction.id
        assert finalized.ready is True

    async def test_missing_id(self, data_layer: DataLayer):
        """An integer id with no matching row raises ``ResourceNotFoundError``."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.get(999999)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.delete(999999)
