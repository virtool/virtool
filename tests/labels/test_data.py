import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.fixtures.client import ClientSpawner
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.labels.sql import SQLLabel
from virtool.models.enums import Permission
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.sql import SQLLegacySample, SQLLegacySampleLabel


class TestCreate:
    async def test_count_is_zero(self, data_layer: DataLayer):
        """A newly created label has no samples, so its count is zero. Nothing can
        reference the label's primary key before it is inserted.
        """
        label = await data_layer.labels.create("Bug", "#a83432", "This is a bug")

        assert label.count == 0


class TestDelete:
    async def test_missing(self, data_layer: DataLayer):
        """Deleting a non-existent label raises ``ResourceNotFoundError``."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.labels.delete(404)

    async def test_removes_sample_label_join_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Deleting a label removes its ``legacy_sample_labels`` join rows."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        label = await fake.labels.create()
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        sample = await data_layer.samples.create(
            CreateSampleRequest(
                files=[upload.id],
                labels=[label.id],
                name="Labelled",
            ),
            client.user.id,
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
                    select(SQLLegacySampleLabel).where(
                        SQLLegacySampleLabel.label_id == label.id,
                    ),
                )
            ).scalars().all() != []

        await data_layer.labels.delete(label.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLLegacySampleLabel).where(
                        SQLLegacySampleLabel.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

            assert (
                await session.execute(
                    select(SQLLabel).where(SQLLabel.id == label.id),
                )
            ).scalar_one_or_none() is None
