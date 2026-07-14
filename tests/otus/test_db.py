import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.fixtures.otus import IMPORTED_CREATED_AT
from virtool.api.custom_json import dump_string, loads
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.otus.db import (
    check_name_and_abbreviation,
    check_sequence_segment,
    find,
    increment_otu_version,
    join,
    join_legacy_otu,
    otu_document_from_row,
    otu_row_values,
    sequence_document_from_row,
    sequence_row_values,
)
from virtool.otus.oas import CreateOTURequest
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.otus.utils import find_isolate
from virtool.types import Document


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


def _as_stored(values: dict) -> Document:
    """Render row values as the ``data`` JSONB column holds and returns them."""
    return loads(dump_string(values["data"]))


class TestOTUDataRoundTrip:
    """``legacy_otus.data`` must be a faithful lift of the Mongo OTU document.

    A JSONB column cannot hold a datetime and Mongo cannot hold microseconds, so an
    imported OTU's ``created_at`` has to survive both. These tests assert against a real
    Mongo round trip rather than a hardcoded millisecond value, so they pin the write
    path to what Mongo actually stores.
    """

    async def test_stores_the_instant_mongo_stores(
        self,
        mongo: Mongo,
        test_imported_otu: Document,
    ):
        """The stored ISO string is the truncated instant Mongo holds, not a finer one."""
        await mongo.otus.insert_one(test_imported_otu)

        document = await mongo.otus.find_one({"_id": test_imported_otu["_id"]})

        assert _as_stored(otu_row_values(test_imported_otu, 1)) == loads(
            dump_string(document),
        )

    async def test_recovers_the_mongo_document(
        self,
        mongo: Mongo,
        test_imported_otu: Document,
    ):
        """Reading the row back yields the document Mongo would have returned."""
        await mongo.otus.insert_one(test_imported_otu)

        row = SQLOTU(data=_as_stored(otu_row_values(test_imported_otu, 1)))

        assert otu_document_from_row(row) == await mongo.otus.find_one(
            {"_id": test_imported_otu["_id"]},
        )

    def test_does_not_mutate_the_document(self, test_imported_otu: Document):
        """The bulk insert path hands the same dict to Mongo afterwards."""
        otu_row_values(test_imported_otu, 1)

        assert test_imported_otu["created_at"] == IMPORTED_CREATED_AT

    def test_otu_without_created_at(self, test_otu: Document):
        """An OTU created through the API carries no ``created_at`` to encode."""
        row = SQLOTU(data=_as_stored(otu_row_values(test_otu, 1)))

        assert "created_at" not in row.data
        assert otu_document_from_row(row) == row.data


class TestPromotedLastIndexedVersion:
    """``last_indexed_version`` is promoted out of the ``data`` JSONB.

    Index builds select the OTUs that have changed since the last build by comparing
    it against ``version``, which has to be a plain SQL comparison rather than a cast
    out of JSONB.
    """

    def test_promotes_an_indexed_otu(self, test_otu: Document):
        assert otu_row_values(test_otu, 1)["last_indexed_version"] == 0

    def test_promotes_a_never_indexed_otu_as_null(self, test_imported_otu: Document):
        """An OTU no index build has ever included carries ``None``."""
        assert otu_row_values(test_imported_otu, 1)["last_indexed_version"] is None


class TestSequenceDataRoundTrip:
    async def test_recovers_the_mongo_document(
        self,
        mongo: Mongo,
        test_sequence: Document,
    ):
        """Sequences hold nothing JSON cannot express, so the column returns what
        was put in it.
        """
        await mongo.sequences.insert_one(test_sequence)

        row = SQLSequence(data=_as_stored(sequence_row_values(test_sequence)))

        assert sequence_document_from_row(row) == await mongo.sequences.find_one(
            {"_id": test_sequence["_id"]},
        )


class TestJoinLegacyOTU:
    """``join_legacy_otu`` rebuilds the joined OTU that ``join`` reads out of Mongo.

    The joined OTU is the document ``dictdiffer`` diffs are taken against and applied
    to, so the two stores have to hand back the same one -- down to the internal fields
    the API never surfaces and the order the sequences arrive in. A field the Postgres
    path drops or coerces does not merely go missing from a response; it corrupts every
    patch taken through :func:`virtool.history.db.patch_to_version`.
    """

    async def _create_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ) -> tuple[str, int, list[str]]:
        """Create an OTU whose sequences interleave across two isolates.

        Interleaved because ``position`` numbers an OTU's sequences rather than each
        isolate's, so an OTU whose isolates were filled one after the other would pass
        even if the sequences were bucketed by the wrong key.

        Returns the OTU id, the reference's primary key and the two isolate ids.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        first = await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "8816-v2",
            user.id,
        )

        second = await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "7865-b1",
            user.id,
        )

        for index, isolate_id in enumerate(
            [first.id, second.id, first.id, second.id],
        ):
            await data_layer.otus.create_sequence(
                otu.id,
                isolate_id,
                f"KX26987{index}",
                f"Prunus virus F segment {index}",
                "TGTTTAAGAGATTAAACAACCGCTTTC",
                user.id,
                "sweet cherry",
            )

        return otu.id, reference.id, [first.id, second.id]

    async def test_equals_mongo_join(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """The whole joined document is identical to the one Mongo joins."""
        otu_id, _, _ = await self._create_otu(data_layer, fake)

        assert await join_legacy_otu(pg, otu_id) == await join(mongo, otu_id)

    async def test_preserves_internal_fields(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The fields ``format_otu`` strips before responding still survive the join.

        ``lower_name`` and a sequence's ``otu_id``, ``isolate_id`` and ``reference``
        are never returned to a client, so nothing in an API-level test would notice
        their loss -- but a diff taken against a document missing them patches to a
        document missing them.
        """
        otu_id, reference_id, _ = await self._create_otu(data_layer, fake)

        joined = await join_legacy_otu(pg, otu_id)

        assert joined["lower_name"] == "prunus virus f"

        for isolate in joined["isolates"]:
            for sequence in isolate["sequences"]:
                assert sequence["otu_id"] == otu_id
                assert sequence["isolate_id"] == isolate["id"]
                assert sequence["reference"] == {"id": reference_id}

    async def test_buckets_sequences_by_isolate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Each isolate gets its own sequences, in the OTU-wide order Mongo returns.

        No sequence crosses into the other isolate, and neither isolate's list is
        shuffled by having the other's interleaved with it.
        """
        otu_id, _, isolate_ids = await self._create_otu(data_layer, fake)

        natural_order = [
            (document["_id"], document["isolate_id"])
            async for document in mongo.sequences.find(
                {"otu_id": otu_id},
                projection=["_id", "isolate_id"],
            )
        ]

        joined = await join_legacy_otu(pg, otu_id)

        assert [isolate["id"] for isolate in joined["isolates"]] == isolate_ids

        for isolate in joined["isolates"]:
            assert [sequence["_id"] for sequence in isolate["sequences"]] == [
                sequence_id
                for sequence_id, isolate_id in natural_order
                if isolate_id == isolate["id"]
            ]

    async def test_orders_sequences_by_position(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """``position`` is what orders the sequences, not the order Postgres finds them.

        Reversing the stored positions must reverse the joined sequences. Nothing else
        in the row changes, so a join that leaned on insertion order or on the primary
        key -- a random 8-character id, and so arbitrary either way -- would return
        them unmoved and pass every other test here.
        """
        otu_id, _, isolate_ids = await self._create_otu(data_layer, fake)

        before = await join_legacy_otu(pg, otu_id)

        async with AsyncSession(pg) as session:
            rows = (
                await session.scalars(
                    select(SQLSequence).where(SQLSequence.otu_id == otu_id),
                )
            ).all()

            highest = max(row.position for row in rows)

            for row in rows:
                row.position = highest - row.position

            await session.commit()

        after = await join_legacy_otu(pg, otu_id)

        for isolate_id in isolate_ids:
            assert [
                sequence["_id"]
                for sequence in find_isolate(after["isolates"], isolate_id)["sequences"]
            ] == [
                sequence["_id"]
                for sequence in reversed(
                    find_isolate(before["isolates"], isolate_id)["sequences"],
                )
            ]

    async def test_recovers_created_at_as_a_datetime(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        test_imported_otu: Document,
    ):
        """An imported OTU's ``created_at`` comes back a datetime, not an ISO string.

        The JSONB column can only hold the timestamp as a string. A joined OTU that
        handed that string back would diff as a change against every Mongo-joined OTU
        it was compared to, and reference clones -- the path that writes a
        ``created_at`` in the first place -- are exactly what takes those diffs.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        document = {**test_imported_otu, "reference": {"id": reference.id}}

        await mongo.otus.insert_one(document)

        async with AsyncSession(pg) as session:
            session.add(SQLOTU(**otu_row_values(document, reference.id)))
            await session.commit()

        joined = await join_legacy_otu(pg, test_imported_otu["_id"])

        assert joined == await join(mongo, test_imported_otu["_id"])
        assert joined["created_at"] == IMPORTED_CREATED_AT.replace(microsecond=123000)

    async def test_isolate_without_sequences_gets_an_empty_list(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """An isolate with no sequences still gets a ``sequences`` key.

        ``verify`` reads that key on every isolate to decide whether an OTU can be
        indexed, so an empty isolate has to arrive as an empty list rather than not
        arrive at all.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "8816-v2",
            user.id,
        )

        joined = await join_legacy_otu(pg, otu.id)

        assert find_isolate(joined["isolates"], isolate.id)["sequences"] == []
        assert joined == await join(mongo, otu.id)

    async def test_returns_none_when_the_otu_has_no_row(self, pg: AsyncEngine):
        """A missing OTU is ``None``, as it is on the Mongo path."""
        assert await join_legacy_otu(pg, "6116cba1") is None
