import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.otus.db import (
    check_name_and_abbreviation,
    check_sequence_segment,
    find,
    increment_otu_version,
    join,
)


@pytest.mark.parametrize(
    "name,abbreviation,return_value",
    [
        ("Foobar Virus", "FBR", None),
        ("Prunus virus F", "FBR", "Name already exists"),
        ("Foobar Virus", "PVF", "Abbreviation already exists"),
        ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
    ],
    ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"],
)
async def test_check_name_and_abbreviation(
    name, abbreviation, return_value, mongo, pg, test_otu
):
    """Test that the function works properly for all possible inputs."""
    await mongo.otus.insert_one(test_otu)

    assert (
        await check_name_and_abbreviation(mongo, pg, "hxn167", name, abbreviation)
        == return_value
    )


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(
    in_db,
    pass_document,
    mocker,
    mongo,
    snapshot,
    test_otu,
    test_sequence,
):
    """Test that an OTU is properly joined when only a ``otu_id`` is provided."""
    await mongo.otus.insert_one(test_otu)
    await mongo.sequences.insert_one(test_sequence)

    m_find_one = mocker.patch.object(
        mongo.otus, "find_one", make_mocked_coro(test_otu if in_db else None)
    )

    kwargs = {"document": test_otu} if pass_document else {}

    joined = await join(mongo, "6116cba1", **kwargs)

    assert m_find_one.called != pass_document

    assert joined == snapshot(name="return")


async def test_increment_otu_version(mongo, snapshot):
    await mongo.otus.insert_one({"_id": "foo", "version": 3, "verified": True})
    await increment_otu_version(mongo, "foo")
    assert await mongo.otus.find_one() == snapshot


class TestCheckSequenceSegment:
    """Test that a sequence's segment is validated against the parent OTU's schema."""

    async def test_defined(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert await check_sequence_segment(mongo, "foo", {"segment": "RNA1"}) is None

    async def test_not_defined(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert (
            await check_sequence_segment(mongo, "foo", {"segment": "RNA2"})
            == "Segment RNA2 is not defined for the parent OTU"
        )

    async def test_no_segment(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert await check_sequence_segment(mongo, "foo", {}) is None


class TestFindModifiedCount:
    """``modified_count`` counts distinct modified OTU ids, not names.

    Counting by name (the legacy behaviour) disagreed with the index metadata's
    ``modified_otu_count`` whenever OTUs shared a name or were renamed across
    versions.
    """

    async def _add_history(
        self,
        pg: AsyncEngine,
        user_id: int,
        created_at,
        rows: list[tuple[str, str, str]],
    ) -> None:
        async with AsyncSession(pg) as session:
            session.add_all(
                SQLLegacyHistory(
                    legacy_id=f"{otu}.{otu_version}",
                    created_at=created_at,
                    description="",
                    method_name="edit",
                    user_id=user_id,
                    otu=otu,
                    otu_name=otu_name,
                    otu_version=otu_version,
                    reference="reference",
                    index=None,
                    index_version=None,
                )
                for otu, otu_name, otu_version in rows
            )
            await session.commit()

    async def test_shared_name_counted_separately(
        self,
        fake,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        """Two OTUs that share a name count as two modifications, not one."""
        user = await fake.users.create()

        await self._add_history(
            pg,
            user.id,
            static_time.datetime,
            [
                ("first_otu", "Shared Name", "0"),
                ("second_otu", "Shared Name", "0"),
            ],
        )

        data = await find(mongo, pg, None, 1, 25, None)

        assert data["modified_count"] == 2

    async def test_renamed_otu_counted_once(
        self,
        fake,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        """One OTU renamed across versions counts as a single modification."""
        user = await fake.users.create()

        await self._add_history(
            pg,
            user.id,
            static_time.datetime,
            [
                ("renamed_otu", "Old Name", "0"),
                ("renamed_otu", "New Name", "1"),
            ],
        )

        data = await find(mongo, pg, None, 1, 25, None)

        assert data["modified_count"] == 1
