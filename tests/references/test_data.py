"""Tests for the references data layer.

``ReferencesData.get`` is intentionally not tested here. Its only production caller is
the jobs-API ``GET /references/v1/{ref_id}`` handler, so it is exercised end-to-end in
``test_api.py`` rather than duplicated against the data layer. As a general rule, when
a data-layer method's sole production caller is a thin API handler, cover it at the API
layer and skip the redundant data-layer test; reserve data-layer tests for logic that
has no direct HTTP entry point of its own.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.references.sql import SQLReference


class TestArchive:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Archiving flags the reference and returns the updated resource."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        assert reference.archived is False

        archived = await data_layer.references.archive(reference.id)

        assert archived.id == reference.id
        assert archived.archived is True

        async with AsyncSession(pg) as session:
            assert (
                await session.scalar(
                    select(SQLReference.archived).where(
                        SQLReference.id == reference.id,
                    ),
                )
                is True
            )

    async def test_already_archived(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Archiving an already-archived reference leaves it archived."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user, archived=True)

        archived = await data_layer.references.archive(reference.id)

        assert archived.archived is True

    async def test_legacy_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A reference that still has a legacy id can be archived by it."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user, id_="legacy_reference")

        archived = await data_layer.references.archive("legacy_reference")

        assert archived.id == reference.id
        assert archived.archived is True

    async def test_not_found(self, data_layer: DataLayer):
        """Archiving a reference that does not exist raises a not-found error."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.archive(999999)
