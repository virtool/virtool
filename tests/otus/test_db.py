import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.fixtures.otus import IMPORTED_CREATED_AT
from virtool.api.custom_json import dump_string, loads
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import Molecule
from virtool.otus.db import (
    check_name_and_abbreviation,
    check_sequence_segment,
    find,
    get_legacy_otu_fields,
    increment_legacy_otu_version,
    join_legacy_otu,
    join_legacy_otu_in_session,
    join_legacy_otus,
    otu_document_from_row,
    otu_row_values,
    sequence_document_from_row,
    sequence_row_values,
    update_legacy_otu_verification,
    update_legacy_sequence_segments,
    write_legacy_otu,
    write_legacy_sequence,
)
from virtool.otus.models import OTUSegment
from virtool.otus.oas import CreateOTURequest, UpdateOTURequest
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.otus.utils import find_isolate
from virtool.types import Document


class TestCheckNameAndAbbreviation:
    """An OTU's name and abbreviation are unique within its parent reference."""

    async def _create_otu(self, data_layer: DataLayer, fake: DataFaker) -> int:
        """Create ``Prunus virus F`` (``PVF``) and return its reference's id."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        return reference.id

    @pytest.mark.parametrize(
        "name,abbreviation,message",
        [
            ("Foobar Virus", "FBR", None),
            ("Prunus virus F", "FBR", "Name already exists"),
            ("Foobar Virus", "PVF", "Abbreviation already exists"),
            ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
        ],
        ids=["neither_exists", "name_exists", "abbreviation_exists", "both_exist"],
    )
    async def test_messages(
        self,
        name: str,
        abbreviation: str,
        message: str | None,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        reference_id = await self._create_otu(data_layer, fake)

        assert (
            await check_name_and_abbreviation(pg, reference_id, name, abbreviation)
            == message
        )

    async def test_name_match_is_case_insensitive(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A name differing only in case is still taken.

        The Mongo query matched a denormalised ``lower_name`` field. Postgres matches
        ``lower(name)`` instead, so this is the behaviour that field existed to provide.
        """
        reference_id = await self._create_otu(data_layer, fake)

        assert (
            await check_name_and_abbreviation(pg, reference_id, "PRUNUS VIRUS F")
            == "Name already exists"
        )

    async def test_scoped_to_reference(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """An OTU in another reference does not make the name or abbreviation taken."""
        await self._create_otu(data_layer, fake)

        other_reference = await fake.references.create(
            user=await fake.users.create(),
        )

        assert (
            await check_name_and_abbreviation(
                pg,
                other_reference.id,
                "Prunus virus F",
                "PVF",
            )
            is None
        )


class TestFindOrder:
    """``find`` orders by ``lower(name)`` then ``id``."""

    async def _insert(
        self,
        insert_otu,
        reference_id: int,
        test_otu: Document,
        rows: list[tuple[str, str]],
    ) -> None:
        for otu_id, name in rows:
            await insert_otu(
                {**test_otu, "_id": otu_id, "name": name, "lower_name": name.lower()},
                reference_id,
            )

    async def test_case_insensitive(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
    ):
        """Names are ordered alphabetically regardless of case.

        The Mongo sort this replaces collated by byte value, which filed every
        capitalised name ahead of every lowercase one.
        """
        reference = await fake.references.create(user=await fake.users.create())

        await self._insert(
            insert_otu,
            reference.id,
            test_otu,
            [
                ("zucchini", "Zucchini yellow mosaic virus"),
                ("alfalfa", "alfalfa mosaic virus"),
            ],
        )

        data = await find(pg, None, 1, 25, None, reference.id)

        assert [document["name"] for document in data["documents"]] == [
            "alfalfa mosaic virus",
            "Zucchini yellow mosaic virus",
        ]

    async def test_shared_name_breaks_tie_on_id(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
    ):
        """OTUs sharing a name are ordered by id, so paging cannot repeat or skip one."""
        reference = await fake.references.create(user=await fake.users.create())

        await self._insert(
            insert_otu,
            reference.id,
            test_otu,
            [
                ("second", "Shared Name"),
                ("first", "Shared Name"),
                ("third", "Shared Name"),
            ],
        )

        first_page = await find(pg, None, 1, 2, None, reference.id)
        second_page = await find(pg, None, 2, 2, None, reference.id)

        assert [document["id"] for document in first_page["documents"]] == [
            "first",
            "second",
        ]
        assert [document["id"] for document in second_page["documents"]] == ["third"]


class TestGetLegacyOTUFields:
    """``get_legacy_otu_fields`` stands in for a projected ``mongo.otus.find_one``."""

    async def test_omits_absent_field(self, insert_otu, fake: DataFaker, pg, test_otu):
        """A field the document does not carry is left out rather than returned as None.

        A Mongo projection omits it too, and ``evaluate_changes`` relies on that: it
        defaults a missing ``abbreviation`` to ``""`` via ``get("abbreviation", "")``,
        which a present-and-``None`` key would defeat.
        """
        reference = await fake.references.create(user=await fake.users.create())

        del test_otu["abbreviation"]

        await insert_otu(test_otu, reference.id)

        assert await get_legacy_otu_fields(
            pg,
            test_otu["_id"],
            ["abbreviation", "name"],
        ) == {"name": "Prunus virus F"}

    async def test_keeps_null_field(self, insert_otu, fake: DataFaker, pg, test_otu):
        """A field the document carries as null is present, not omitted."""
        reference = await fake.references.create(user=await fake.users.create())

        await insert_otu({**test_otu, "abbreviation": None}, reference.id)

        assert await get_legacy_otu_fields(pg, test_otu["_id"], ["abbreviation"]) == {
            "abbreviation": None,
        }

    async def test_no_otu(self, pg):
        assert await get_legacy_otu_fields(pg, "missing", ["name"]) is None


class TestCheckSequenceSegment:
    """Test that a sequence's segment is validated against the parent OTU's schema."""

    async def _create_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        *,
        with_schema: bool,
    ) -> str:
        """Create an OTU, optionally carrying an ``RNA1`` segment, and return its id."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        if with_schema:
            otu = await data_layer.otus.update(
                otu.id,
                UpdateOTURequest(
                    schema=[
                        OTUSegment(
                            molecule=Molecule.ss_rna,
                            name="RNA1",
                            required=True,
                        ),
                    ],
                ),
                user.id,
            )

        return otu.id

    async def test_defined(self, data_layer: DataLayer, fake: DataFaker, pg):
        otu_id = await self._create_otu(data_layer, fake, with_schema=True)

        assert await check_sequence_segment(pg, otu_id, {"segment": "RNA1"}) is None

    async def test_not_defined(self, data_layer: DataLayer, fake: DataFaker, pg):
        otu_id = await self._create_otu(data_layer, fake, with_schema=True)

        assert (
            await check_sequence_segment(pg, otu_id, {"segment": "RNA2"})
            == "Segment RNA2 is not defined for the parent OTU"
        )

    async def test_no_segment(self, data_layer: DataLayer, fake: DataFaker, pg):
        otu_id = await self._create_otu(data_layer, fake, with_schema=True)

        assert await check_sequence_segment(pg, otu_id, {}) is None

    async def test_no_schema(self, data_layer: DataLayer, fake: DataFaker, pg):
        """An OTU that carries no schema defines no segment."""
        otu_id = await self._create_otu(data_layer, fake, with_schema=False)

        assert (
            await check_sequence_segment(pg, otu_id, {"segment": "RNA1"})
            == "Segment RNA1 is not defined for the parent OTU"
        )


class TestFindModifiedCount:
    """``modified_count`` counts distinct modified OTU ids, not names.

    Counting by name (the legacy behaviour) disagreed with the index metadata's
    ``modified_otu_count`` whenever OTUs shared a name or were renamed across
    versions.
    """

    async def test_shared_name_counted_separately(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Two OTUs that share a name count as two modifications, not one."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        for abbreviation in ("SNA", "SNB"):
            await data_layer.otus.create(
                reference.id,
                CreateOTURequest(name="Shared Name", abbreviation=abbreviation),
                user.id,
            )

        data = await find(pg, None, 1, 25, None)

        assert data["modified_count"] == 2

    async def test_renamed_otu_counted_once(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """One OTU renamed across versions counts as a single modification."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Old Name", abbreviation="ON"),
            user.id,
        )

        await data_layer.otus.update(
            otu.id,
            UpdateOTURequest(name="New Name"),
            user.id,
        )

        data = await find(pg, None, 1, 25, None)

        assert data["modified_count"] == 1


def _as_stored(values: dict) -> Document:
    """Render row values as the ``data`` JSONB column holds and returns them."""
    return loads(dump_string(values["data"]))


class TestOTUDataRoundTrip:
    """``legacy_otus.data`` must be a faithful lift of the Mongo OTU document.

    A JSONB column cannot hold a datetime and Mongo could not hold microseconds, so an
    imported OTU's ``created_at`` has to survive both. These tests assert against the
    millisecond-truncated instant Mongo floored the timestamp to, pinning the write
    path to that historical behaviour.
    """

    def test_stores_the_instant_mongo_stores(
        self,
        test_imported_otu: Document,
    ):
        """The stored ISO string is the truncated instant Mongo held, not a finer one."""
        stored = {
            **test_imported_otu,
            "created_at": IMPORTED_CREATED_AT.replace(microsecond=123000),
        }

        assert _as_stored(otu_row_values(test_imported_otu, 1)) == loads(
            dump_string(stored),
        )

    def test_recovers_the_mongo_document(
        self,
        test_imported_otu: Document,
    ):
        """Reading the row back yields the document that was imported."""
        row = SQLOTU(data=_as_stored(otu_row_values(test_imported_otu, 1)))

        assert otu_document_from_row(row) == {
            **test_imported_otu,
            "created_at": IMPORTED_CREATED_AT.replace(microsecond=123000),
        }

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
    def test_recovers_the_mongo_document(
        self,
        test_sequence: Document,
    ):
        """Sequences hold nothing JSON cannot express, so the column returns what
        was put in it.
        """
        row = SQLSequence(data=_as_stored(sequence_row_values(test_sequence)))

        assert sequence_document_from_row(row) == test_sequence


class TestJoinLegacyOTU:
    """``join_legacy_otu`` rebuilds a joined OTU from the ``legacy_otus`` table.

    The joined OTU is the document ``dictdiffer`` diffs are taken against and applied
    to, so the join has to reproduce the whole document -- down to the internal fields
    the API never surfaces and the order the sequences arrive in. A field the join drops
    or coerces does not merely go missing from a response; it corrupts every patch taken
    through :func:`virtool.history.db.patch_to_version`.
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
        pg: AsyncEngine,
    ):
        """Each isolate gets its own sequences, in the OTU-wide ``position`` order.

        No sequence crosses into the other isolate, and neither isolate's list is
        shuffled by having the other's interleaved with it.
        """
        otu_id, _, isolate_ids = await self._create_otu(data_layer, fake)

        async with AsyncSession(pg) as session:
            natural_order = [
                (row.id, row.isolate_id)
                for row in (
                    await session.scalars(
                        select(SQLSequence)
                        .where(SQLSequence.otu_id == otu_id)
                        .order_by(SQLSequence.position),
                    )
                ).all()
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
        pg: AsyncEngine,
        test_imported_otu: Document,
    ):
        """An imported OTU's ``created_at`` comes back a datetime, not an ISO string.

        The JSONB column can only hold the timestamp as a string. A joined OTU that
        handed that string back would diff as a change, and reference clones -- the path
        that writes a ``created_at`` in the first place -- are exactly what takes those
        diffs.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        document = {**test_imported_otu, "reference": {"id": reference.id}}

        async with AsyncSession(pg) as session:
            session.add(SQLOTU(**otu_row_values(document, reference.id)))
            await session.commit()

        joined = await join_legacy_otu(pg, test_imported_otu["_id"])

        assert joined["created_at"] == IMPORTED_CREATED_AT.replace(microsecond=123000)

    async def test_isolate_without_sequences_gets_an_empty_list(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

    async def test_returns_none_when_the_otu_has_no_row(self, pg: AsyncEngine):
        """A missing OTU is ``None``."""
        assert await join_legacy_otu(pg, "6116cba1") is None


class TestJoinLegacyOTUs:
    """``join_legacy_otus`` joins a whole set of OTUs in two queries.

    It is the read every OTU join resolves to, so a batch has to hand back exactly what
    joining each OTU on its own does. The sequences of every OTU come back from one
    query and are bucketed by ``otu_id`` here rather than by the ``WHERE`` clause, which
    is the part a batch can get wrong and the single-OTU read cannot.
    """

    async def _create_otus(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ) -> list[str]:
        """Create two OTUs whose sequences are written interleaved across both.

        Interleaved because OTUs filled one after the other would join correctly even if
        their sequences were bucketed by the wrong key, or left in the order one query
        happened to return them in.

        Returns the two OTU ids.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu_ids = []
        isolate_ids = []

        for name, abbreviation in (
            ("Prunus virus F", "PVF"),
            ("Cherry virus A", "CVA"),
        ):
            otu = await data_layer.otus.create(
                reference.id,
                CreateOTURequest(name=name, abbreviation=abbreviation),
                user.id,
            )

            isolate = await data_layer.otus.add_isolate(
                otu.id,
                "isolate",
                "8816-v2",
                user.id,
            )

            otu_ids.append(otu.id)
            isolate_ids.append(isolate.id)

        for index in range(4):
            otu_index = index % 2

            await data_layer.otus.create_sequence(
                otu_ids[otu_index],
                isolate_ids[otu_index],
                f"KX26987{index}",
                f"Prunus virus F segment {index}",
                "TGTTTAAGAGATTAAACAACCGCTTTC",
                user.id,
                "sweet cherry",
            )

        return otu_ids

    async def test_equals_single_joins(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Every OTU joins as it does on its own, sequences and their order included."""
        otu_ids = await self._create_otus(data_layer, fake)

        assert await join_legacy_otus(pg, otu_ids) == {
            otu_id: await join_legacy_otu(pg, otu_id) for otu_id in otu_ids
        }

    async def test_omits_otu_with_no_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A missing OTU is absent from the mapping rather than mapped to ``None``.

        The rest of the batch still joins, so one bad id cannot cost a caller the OTUs
        it asked for alongside it.
        """
        otu_ids = await self._create_otus(data_layer, fake)

        joined = await join_legacy_otus(pg, [*otu_ids, "6116cba1"])

        assert sorted(joined) == sorted(otu_ids)

    async def test_no_otu_ids(self, pg: AsyncEngine):
        """Asking for no OTUs is empty rather than an error or every OTU."""
        assert await join_legacy_otus(pg, []) == {}


class TestJoinLegacyOTUInSession:
    """``join_legacy_otu_in_session`` joins through the caller's own session.

    The OTU write path composes its history diff from the OTU as it stands before and
    after its own writes, all inside one uncommitted transaction. A join that opened a
    session of its own would see neither, so the diff would come out empty and the
    change would be recorded as a no-op.
    """

    async def _create_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ) -> tuple[str, str]:
        """Create ``Prunus virus F`` with one isolate and one sequence.

        Returns the OTU id and the sequence id.
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

        sequence = await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "KX269872",
            "Prunus virus F segment",
            "TGTTTAAGAGATTAAACAACCGCTTTC",
            user.id,
            "sweet cherry",
        )

        return otu.id, sequence.id

    async def test_matches_the_engine_join(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A committed OTU joins to the same document either entry point reads it."""
        otu_id, _ = await self._create_otu(data_layer, fake)

        async with AsyncSession(pg) as session:
            assert await join_legacy_otu_in_session(session, otu_id) == (
                await join_legacy_otu(pg, otu_id)
            )

    async def test_returns_none_when_the_otu_has_no_row(self, pg: AsyncEngine):
        """A missing OTU is ``None``, as it is on the engine path."""
        async with AsyncSession(pg) as session:
            assert await join_legacy_otu_in_session(session, "6116cba1") is None

    async def test_reads_an_uncommitted_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """An OTU written but not committed joins as it now stands.

        The engine join is checked from outside the transaction in the same breath: it
        must still read the committed name, or the test would pass on a session that
        had quietly committed rather than on one that reads its own writes.
        """
        otu_id, _ = await self._create_otu(data_layer, fake)

        async with AsyncSession(pg) as session:
            document = otu_document_from_row(await session.get(SQLOTU, otu_id))

        async with AsyncSession(pg) as session:
            await write_legacy_otu(
                session,
                {**document, "name": "Prunus virus G", "lower_name": "prunus virus g"},
            )

            assert (await join_legacy_otu_in_session(session, otu_id))["name"] == (
                "Prunus virus G"
            )
            assert (await join_legacy_otu(pg, otu_id))["name"] == "Prunus virus F"

    async def test_rejoins_an_otu_written_after_it_was_joined(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Joining, writing and joining again reflects the write the second time.

        This is the write path's diff-composing sequence. ``write_legacy_otu`` upserts
        through Core DML, which does not synchronize the session's identity map, so a
        rejoin that trusted the map would hand back the pre-write document and diff the
        OTU against itself.

        The row is deliberately held in ``row`` for the length of the transaction. The
        identity map holds its rows weakly and the join keeps no reference to the ones it
        loads, so without something holding it the stale row is collected before the
        rejoin and the lookup falls through to a fresh ``SELECT`` -- passing for a reason
        that has nothing to do with the behaviour under test. Holding it reproduces what
        any caller that touched the row itself would do.
        """
        otu_id, _ = await self._create_otu(data_layer, fake)

        async with AsyncSession(pg) as session:
            document = otu_document_from_row(await session.get(SQLOTU, otu_id))

        async with AsyncSession(pg) as session:
            before = await join_legacy_otu_in_session(session, otu_id)

            row = await session.get(SQLOTU, otu_id)

            await write_legacy_otu(
                session,
                {**document, "name": "Prunus virus G", "lower_name": "prunus virus g"},
            )

            assert row.data["name"] == "Prunus virus F"

            after = await join_legacy_otu_in_session(session, otu_id)

        assert before["name"] == "Prunus virus F"
        assert after["name"] == "Prunus virus G"

    async def test_rejoins_a_sequence_written_after_it_was_joined(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A sequence rewritten after the first join comes back rewritten.

        The sequences are loaded by an ORM ``select`` rather than by primary key, and it
        caches into the same identity map the OTU row does, so it needs its own
        ``populate_existing``. Editing a sequence is the commonest OTU change there is,
        so a stale sequence would empty out most diffs the write path takes.

        The row is held for the same reason as in the OTU case above: the identity map
        holds it weakly, and an unheld row is collected before the rejoin can read it
        back stale.
        """
        otu_id, sequence_id = await self._create_otu(data_layer, fake)

        async with AsyncSession(pg) as session:
            document = sequence_document_from_row(
                await session.get(SQLSequence, sequence_id),
            )

        async with AsyncSession(pg) as session:
            before = await join_legacy_otu_in_session(session, otu_id)

            row = await session.get(SQLSequence, sequence_id)

            await write_legacy_sequence(session, {**document, "sequence": "ATGAAC"})

            assert row.data["sequence"] == "TGTTTAAGAGATTAAACAACCGCTTTC"

            after = await join_legacy_otu_in_session(session, otu_id)

        assert before["isolates"][0]["sequences"][0]["sequence"] == (
            "TGTTTAAGAGATTAAACAACCGCTTTC"
        )
        assert after["isolates"][0]["sequences"][0]["sequence"] == "ATGAAC"


class TestIncrementLegacyOTUVersion:
    """``increment_legacy_otu_version`` bumps an OTU's version and unverifies it.

    ``version`` and ``verified`` are each held twice -- once in a promoted column and
    once in the ``data`` JSONB the document is recovered from. A bump that moved one
    without the other would leave the OTU reading differently depending on which the
    caller looked at, so both are asserted every time.
    """

    async def _insert(
        self,
        fake: DataFaker,
        insert_otu,
        test_otu: Document,
        **overrides,
    ) -> str:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await insert_otu({**test_otu, **overrides}, reference.id)

        return test_otu["_id"]

    async def test_bumps_version_and_clears_verified(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
    ):
        """The column and its ``data`` counterpart move together."""
        otu_id = await self._insert(
            fake,
            insert_otu,
            test_otu,
            version=3,
            verified=True,
        )

        async with AsyncSession(pg) as session:
            await increment_legacy_otu_version(session, otu_id)
            await session.commit()

            row = await session.get(SQLOTU, otu_id, populate_existing=True)

        assert (row.version, row.verified) == (4, False)
        assert (row.data["version"], row.data["verified"]) == (4, False)

    async def test_returns_the_updated_document(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
    ):
        """The document returned is the OTU as it now stands.

        The write path takes it as the OTU half of the joined document, so it has to be
        the whole OTU document at its new version rather than the fields the bump
        touched.
        """
        otu_id = await self._insert(
            fake,
            insert_otu,
            test_otu,
            version=3,
            verified=True,
        )

        async with AsyncSession(pg) as session:
            document = await increment_legacy_otu_version(session, otu_id)
            await session.commit()

            row = await session.get(SQLOTU, otu_id, populate_existing=True)

        assert document["version"] == 4
        assert document["verified"] is False
        assert document == otu_document_from_row(row)

    async def test_decodes_created_at(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_imported_otu: Document,
    ):
        """An imported OTU's ``created_at`` comes back as a datetime, not a string.

        The bump reads ``data`` straight out of Postgres rather than through a mapped
        row, so it has to decode the column itself.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await insert_otu(test_imported_otu, reference.id)

        async with AsyncSession(pg) as session:
            document = await increment_legacy_otu_version(
                session,
                test_imported_otu["_id"],
            )
            await session.commit()

        assert document["created_at"] == IMPORTED_CREATED_AT.replace(microsecond=123000)

    async def test_leaves_other_fields_alone(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
    ):
        """Only ``version`` and ``verified`` change; the rest of ``data`` is untouched."""
        otu_id = await self._insert(fake, insert_otu, test_otu)

        before = await join_legacy_otu(pg, otu_id)

        async with AsyncSession(pg) as session:
            await increment_legacy_otu_version(session, otu_id)
            await session.commit()

        after = await join_legacy_otu(pg, otu_id)

        assert {**after, "version": 0, "verified": False} == before

    async def test_missing_otu(self, pg: AsyncEngine):
        """An OTU with no row has no version to bump."""
        async with AsyncSession(pg) as session:
            assert await increment_legacy_otu_version(session, "6116cba1") is None


class TestUpdateLegacyOTUVerification:
    """``update_legacy_otu_verification`` verifies an OTU that ``verify`` passes."""

    async def _insert(
        self,
        fake: DataFaker,
        insert_otu,
        test_otu: Document,
        test_sequence: Document,
        *,
        with_sequence: bool,
    ) -> str:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await insert_otu(
            test_otu,
            reference.id,
            [test_sequence] if with_sequence else None,
        )

        return test_otu["_id"]

    async def test_verifies_otu_without_issues(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """``verified`` is set in the column and in ``data``, and ``None`` returned."""
        otu_id = await self._insert(
            fake,
            insert_otu,
            test_otu,
            test_sequence,
            with_sequence=True,
        )

        joined = await join_legacy_otu(pg, otu_id)

        async with AsyncSession(pg) as session:
            assert await update_legacy_otu_verification(session, joined) is None
            await session.commit()

            row = await session.get(SQLOTU, otu_id, populate_existing=True)

        assert row.verified is True
        assert row.data["verified"] is True

    async def test_mutates_the_joined_otu(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """The caller's copy agrees with the row it just wrote.

        The OTU write path composes its history diff from the joined OTU it passed in,
        so a copy left saying ``verified: False`` would diff against a row that says
        otherwise.
        """
        otu_id = await self._insert(
            fake,
            insert_otu,
            test_otu,
            test_sequence,
            with_sequence=True,
        )

        joined = await join_legacy_otu(pg, otu_id)

        assert joined["verified"] is False

        async with AsyncSession(pg) as session:
            await update_legacy_otu_verification(session, joined)
            await session.commit()

        assert joined["verified"] is True

    async def test_leaves_otu_with_issues_unverified(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """An OTU whose isolate has no sequences is returned its issues and not written."""
        otu_id = await self._insert(
            fake,
            insert_otu,
            test_otu,
            test_sequence,
            with_sequence=False,
        )

        joined = await join_legacy_otu(pg, otu_id)

        async with AsyncSession(pg) as session:
            issues = await update_legacy_otu_verification(session, joined)
            await session.commit()

            row = await session.get(SQLOTU, otu_id, populate_existing=True)

        assert issues["empty_isolate"] == ["cab8b360"]
        assert joined["verified"] is False
        assert row.verified is False
        assert row.data["verified"] is False


class TestUpdateLegacySequenceSegments:
    """``update_legacy_sequence_segments`` unsets segments dropped from an OTU's schema.

    The segment has to be *removed* from ``data`` rather than nulled. ``data`` is a lift
    of the OTU document, where an unset segment is an absent field, so a lingering
    ``segment: null`` would make the joined OTU -- and every ``dictdiffer`` patch taken
    against it -- diff a changed field where an absent one diffs a removed field.
    """

    async def _insert(
        self,
        fake: DataFaker,
        insert_otu,
        test_otu: Document,
        test_sequence: Document,
        segment: str,
    ) -> None:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await insert_otu(
            {**test_otu, "schema": [{"name": "RNA1"}, {"name": "RNA2"}]},
            reference.id,
            [{**test_sequence, "segment": segment}],
        )

    async def _drop_rna2(
        self,
        pg: AsyncEngine,
        otu_id: str,
    ) -> None:
        old = await join_legacy_otu(pg, otu_id)
        new = {**old, "schema": [{"name": "RNA1"}]}

        async with AsyncSession(pg) as session:
            await update_legacy_sequence_segments(session, old, new)
            await session.commit()

    async def test_removes_the_segment_key(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """The column goes null and the key leaves ``data`` entirely."""
        await self._insert(fake, insert_otu, test_otu, test_sequence, "RNA2")

        await self._drop_rna2(pg, test_otu["_id"])

        async with AsyncSession(pg) as session:
            row = await session.get(
                SQLSequence,
                test_sequence["_id"],
                populate_existing=True,
            )

        assert row.segment is None
        assert "segment" not in row.data

    async def test_keeps_a_retained_segment(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """A sequence naming a segment the schema still defines is left alone."""
        await self._insert(fake, insert_otu, test_otu, test_sequence, "RNA1")

        await self._drop_rna2(pg, test_otu["_id"])

        async with AsyncSession(pg) as session:
            row = await session.get(
                SQLSequence,
                test_sequence["_id"],
                populate_existing=True,
            )

        assert row.segment == "RNA1"
        assert row.data["segment"] == "RNA1"

    async def test_otu_gaining_its_first_schema(
        self,
        fake: DataFaker,
        insert_otu,
        pg: AsyncEngine,
        test_otu: Document,
        test_sequence: Document,
    ):
        """An OTU with no ``schema`` before the edit has no segment names to drop."""
        await self._insert(fake, insert_otu, test_otu, test_sequence, "RNA2")

        old = await join_legacy_otu(pg, test_otu["_id"])

        async with AsyncSession(pg) as session:
            await update_legacy_sequence_segments(
                session,
                {key: value for key, value in old.items() if key != "schema"},
                {**old, "schema": [{"name": "RNA1"}]},
            )
            await session.commit()

            row = await session.get(
                SQLSequence,
                test_sequence["_id"],
                populate_existing=True,
            )

        assert row.segment == "RNA2"
