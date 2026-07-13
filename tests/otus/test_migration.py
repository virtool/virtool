"""Tests for the Mongo-to-Postgres OTU and sequence backfill and parity gate."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import pytest
from motor.motor_asyncio import AsyncIOMotorCollection
from sqlalchemy import insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext
from virtool.otus.db import bulk_insert_otu_rows, otu_row_values
from virtool.otus.migration import (
    backfill_sequence_positions,
    compare_otu_and_sequence_stores,
    compare_sequence_positions,
    copy_otus_and_sequences_to_postgres,
)
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.utils import timestamp


async def _seed_reference(ctx: MigrationContext, legacy_id: str = "ref_legacy") -> int:
    """Insert an owning user and a ``legacy_references`` row; return its id."""
    async with AsyncSession(ctx.pg) as session:
        user_id = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'reference_owner', 'reference_owner_legacy', true, '',
                        false, false, :now, :pw, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "pw": b"hashed"},
            )
        ).scalar_one()

        reference_id = (
            await session.execute(
                text("""
                    INSERT INTO legacy_references (
                        legacy_id, name, description, organism, created_at,
                        archived, restrict_source_types, source_types, user_id
                    )
                    VALUES (
                        :legacy_id, 'Plant Viruses', '', '', :now,
                        false, false, '[]'::jsonb, :user_id
                    )
                    RETURNING id
                """),
                {"legacy_id": legacy_id, "now": timestamp(), "user_id": user_id},
            )
        ).scalar_one()
        await session.commit()

    return reference_id


_CREATED_AT = datetime(2025, 7, 2, 21, 18, 48, 420000)
"""The ``created_at`` carried by legacy OTU documents.

A naive UTC ``datetime``, as Mongo returns it. JSONB cannot hold one, so the write
path stores it as the ISO string in :data:`_CREATED_AT_JSON`.
"""

_CREATED_AT_JSON = "2025-07-02T21:18:48.420000Z"
"""How :data:`_CREATED_AT` comes back out of the ``data`` JSONB column."""


def _otu_doc(otu_id: str, reference_id: int, name: str) -> dict:
    return {
        "_id": otu_id,
        "name": name,
        "abbreviation": name[:3].upper(),
        "created_at": _CREATED_AT,
        "reference": {"id": reference_id},
        "verified": True,
        "version": 3,
        "isolates": [
            {"id": "isolate_a", "source_type": "isolate", "source_name": "A"},
        ],
        "schema": [],
    }


def _sequence_doc(
    sequence_id: str,
    otu_id: str,
    isolate_id: str = "isolate_a",
    segment: str | None = "RNA1",
) -> dict:
    return {
        "_id": sequence_id,
        "otu_id": otu_id,
        "isolate_id": isolate_id,
        "segment": segment,
        "accession": "AB000001",
        "definition": "A test sequence",
        "host": "",
        "sequence": "ATGC",
    }


async def _fetch_otu(ctx: MigrationContext, otu_id: str):
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("""
                    SELECT id, data, name, abbreviation, reference_id,
                           verified, version
                    FROM legacy_otus WHERE id = :id
                """),
                {"id": otu_id},
            )
        ).one_or_none()


async def _fetch_sequence(ctx: MigrationContext, sequence_id: str):
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("""
                    SELECT id, data, otu_id, isolate_id, segment
                    FROM legacy_sequences WHERE id = :id
                """),
                {"id": sequence_id},
            )
        ).one_or_none()


async def _insert_otu_row(
    ctx: MigrationContext, otu_id: str, reference_id: int
) -> None:
    """Insert a ``legacy_otus`` row directly, as an application dual-write would."""
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            insert(SQLOTU).values(
                **otu_row_values(
                    _otu_doc(otu_id, reference_id, "Cucumber mosaic virus"),
                    reference_id,
                ),
            ),
        )
        await session.commit()


async def _mongo_sequence_ids(ctx: MigrationContext, otu_id: str) -> list[str]:
    """Get an OTU's sequence ids in the natural order ``join`` reads them in."""
    return [
        document["_id"]
        async for document in ctx.mongo.sequences.find(
            {"otu_id": otu_id},
            projection=["_id"],
        )
    ]


async def _count(ctx: MigrationContext, table: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(text(f"SELECT count(*) FROM {table}"))  # noqa: S608
        ).scalar_one()


@pytest.fixture
async def reference_id(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Apply the full schema and seed one reference; return its integer id."""
    await asyncio.to_thread(apply_alembic, "head")
    return await _seed_reference(ctx)


class TestCopyOtusAndSequences:
    async def test_backfills_otus_and_sequences(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        otu = _otu_doc("otu_00000000", reference_id, "Tobacco mosaic virus")
        sequence = _sequence_doc("seq_00000000", "otu_00000000")

        await ctx.mongo.otus.insert_one(otu)
        await ctx.mongo.sequences.insert_one(sequence)

        await copy_otus_and_sequences_to_postgres(ctx)

        otu_row = await _fetch_otu(ctx, "otu_00000000")
        assert otu_row.data == {**otu, "created_at": _CREATED_AT_JSON}
        assert otu_row.name == "Tobacco mosaic virus"
        assert otu_row.abbreviation == "TOB"
        assert otu_row.reference_id == reference_id
        assert otu_row.verified is True
        assert otu_row.version == 3

        sequence_row = await _fetch_sequence(ctx, "seq_00000000")
        assert sequence_row.data == sequence
        assert sequence_row.otu_id == "otu_00000000"
        assert sequence_row.isolate_id == "isolate_a"
        assert sequence_row.segment == "RNA1"

    async def test_missing_segment_backfills_null(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_00000000", reference_id, "Potato virus Y"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_00000000", "otu_00000000", segment=None),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        sequence_row = await _fetch_sequence(ctx, "seq_00000000")
        assert sequence_row.segment is None

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_00000000", reference_id, "Tobacco mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_00000000", "otu_00000000"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)
        await copy_otus_and_sequences_to_postgres(ctx)

        assert await _count(ctx, "legacy_otus") == 1
        assert await _count(ctx, "legacy_sequences") == 1

    async def test_converges_documents_added_after_first_run(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_existing", reference_id, "Tobacco mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_existing", "otu_existing"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_gap", reference_id, "Potato virus Y"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_gap", "otu_gap"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        assert await _fetch_otu(ctx, "otu_gap") is not None
        assert await _fetch_sequence(ctx, "seq_gap") is not None
        assert await _count(ctx, "legacy_otus") == 2
        assert await _count(ctx, "legacy_sequences") == 2

    async def test_unresolvable_reference_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_00000000", 999999, "Ghost virus"),
        )

        with pytest.raises(ValueError, match="which does not exist in postgres"):
            await copy_otus_and_sequences_to_postgres(ctx)

    async def test_orphan_sequence_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_00000000", reference_id, "Tobacco mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_orphan", "otu_missing"),
        )

        with pytest.raises(ValueError, match="does not exist in postgres"):
            await copy_otus_and_sequences_to_postgres(ctx)

    async def test_otu_dual_written_mid_run_is_not_an_orphan(
        self,
        ctx: MigrationContext,
        reference_id: int,
        mocker,
    ):
        """A parent OTU that lands in Postgres mid-run must not be called an orphan.

        The application keeps dual-writing while the backfill runs, so a parent OTU
        can appear in Postgres after the sequence pass cached its OTU id set. The
        stale set must not be the only thing consulted before rejecting a sequence.
        """
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_dual_written", "otu_dual_written"),
        )

        real_find_one = AsyncIOMotorCollection.find_one

        async def find_one_after_dual_write(self, *args, **kwargs):
            if self.name == "sequences":
                await _insert_otu_row(ctx, "otu_dual_written", reference_id)

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            find_one_after_dual_write,
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        assert await _fetch_sequence(ctx, "seq_dual_written") is not None


async def _update_otu_row(ctx: MigrationContext, otu_id: str, **values) -> None:
    """Change a ``legacy_otus`` row's columns without touching Mongo."""
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            update(SQLOTU).where(SQLOTU.id == otu_id).values(**values),
        )
        await session.commit()


async def _update_sequence_row(
    ctx: MigrationContext,
    sequence_id: str,
    **values,
) -> None:
    """Change a ``legacy_sequences`` row's columns without touching Mongo."""
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            update(SQLSequence).where(SQLSequence.id == sequence_id).values(**values),
        )
        await session.commit()


class TestCompareOtuAndSequenceStores:
    @pytest.fixture
    async def matching_stores(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ) -> None:
        """Seed one OTU and one sequence and copy both into Postgres."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_matched", reference_id, "Tobacco mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_matched", "otu_matched"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

    async def test_matching_stores_pass(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """Matching stores pass, including the OTU's datetime ``created_at``.

        A ``datetime`` cannot survive the JSONB round trip as a ``datetime``: it is
        stored and read back as an ISO string. The gate must not read that as drift.
        """
        await compare_otu_and_sequence_stores(ctx)

    async def test_bulk_written_otu_passes(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """An OTU written by the bulk import path passes, despite a ``created_at``
        carrying microseconds Mongo cannot hold.

        The bulk path hands the same in-memory dict to Postgres and to Mongo, making it
        the one writer whose datetime never round-tripped through BSON. Mongo floors it
        to the millisecond, so the row has to hold that same instant and not the finer
        one it was handed. Every other writer passes a document read back out of Mongo
        and so is already truncated.
        """
        document = {
            **_otu_doc("otu_bulk", reference_id, "Bulk written virus"),
            "created_at": datetime(2025, 7, 2, 21, 18, 48, 420789),
        }

        async with AsyncSession(ctx.pg) as session:
            await bulk_insert_otu_rows(session, [document], reference_id)
            await session.commit()

        await ctx.mongo.otus.insert_one(document)

        await compare_otu_and_sequence_stores(ctx)

    async def test_is_read_only_and_repeatable(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """Two runs over unchanged stores agree, and neither writes anything."""
        await compare_otu_and_sequence_stores(ctx)
        await compare_otu_and_sequence_stores(ctx)

        assert await _count(ctx, "legacy_otus") == 1
        assert await _count(ctx, "legacy_sequences") == 1
        assert await ctx.mongo.otus.count_documents({}) == 1
        assert await ctx.mongo.sequences.count_documents({}) == 1

    async def test_otu_missing_from_postgres_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
        matching_stores: None,
    ):
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_not_written", reference_id, "Potato virus Y"),
        )

        with pytest.raises(ValueError, match="1 otus and 0 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_missing_from_postgres_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_not_written", "otu_matched"),
        )

        with pytest.raises(ValueError, match="0 otus and 1 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_missing_from_mongo_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A Postgres row whose Mongo document was deleted is drift, not an aside."""
        await ctx.mongo.otus.delete_one({"_id": "otu_matched"})

        with pytest.raises(ValueError, match="1 otus and 0 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_missing_from_mongo_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        await ctx.mongo.sequences.delete_one({"_id": "seq_matched"})

        with pytest.raises(ValueError, match="0 otus and 1 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_data_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A Mongo edit that never reached Postgres is drift."""
        await ctx.mongo.otus.update_one(
            {"_id": "otu_matched"},
            {"$set": {"version": 4, "verified": False}},
        )

        with pytest.raises(ValueError, match="1 otus and 0 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_column_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A promoted column that disagrees with an otherwise-matching ``data``."""
        await _update_otu_row(ctx, "otu_matched", name="Wrong name")

        with pytest.raises(ValueError, match="1 otus and 0 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_column_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        await _update_sequence_row(ctx, "seq_matched", segment="RNA2")

        with pytest.raises(ValueError, match="0 otus and 1 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_reports_every_drifted_document(
        self,
        ctx: MigrationContext,
        reference_id: int,
        matching_stores: None,
    ):
        """Drift is accumulated across the whole run, not raised on the first hit."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_second", reference_id, "Potato virus Y"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_second", "otu_second"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        await _update_otu_row(ctx, "otu_matched", verified=False)
        await _update_otu_row(ctx, "otu_second", version=99)
        await _update_sequence_row(ctx, "seq_second", isolate_id="isolate_wrong")

        with pytest.raises(ValueError, match="2 otus and 1 sequences"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_row_written_mid_run_is_not_drift(
        self,
        ctx: MigrationContext,
        matching_stores: None,
        mocker,
    ):
        """A dual-write that lands between the scan and the re-read is not drift.

        The scan sees a Postgres row that has fallen behind Mongo and flags the
        OTU. The application then dual-writes the row before the candidate is
        re-read. The re-read must go back to Postgres rather than reuse the row the
        scan already loaded, or the stores are reported as drifted after they have
        converged.
        """
        await ctx.mongo.otus.update_one(
            {"_id": "otu_matched"},
            {"$set": {"version": 4}},
        )

        document = await ctx.mongo.otus.find_one({"_id": "otu_matched"})

        real_find_one = AsyncIOMotorCollection.find_one

        async def find_one_after_dual_write(self, *args, **kwargs):
            if self.name == "otus":
                await _update_otu_row(ctx, "otu_matched", data=document, version=4)

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            find_one_after_dual_write,
        )

        await compare_otu_and_sequence_stores(ctx)

    async def test_null_abbreviation_and_missing_segment_pass(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """The write path's own normalizations must not read as drift.

        Mongo stores a null abbreviation and omits ``segment`` entirely; Postgres
        holds ``""`` and ``NULL``. Both stores are in parity.
        """
        otu = _otu_doc("otu_null_abbreviation", reference_id, "Potato virus Y")
        otu["abbreviation"] = None

        sequence = _sequence_doc("seq_no_segment", "otu_null_abbreviation")
        del sequence["segment"]

        await ctx.mongo.otus.insert_one(otu)
        await ctx.mongo.sequences.insert_one(sequence)

        await copy_otus_and_sequences_to_postgres(ctx)

        await compare_otu_and_sequence_stores(ctx)

    async def test_legacy_string_reference_id_passes(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """An OTU still holding the legacy string ``reference.id`` is in parity.

        Postgres promotes it to the integer ``legacy_references`` primary key, so
        the two forms must resolve to the same reference.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_legacy_reference", "ref_legacy", "Cucumber mosaic virus"),
        )

        await copy_otus_and_sequences_to_postgres(ctx)

        await compare_otu_and_sequence_stores(ctx)


async def _get_positions(ctx: MigrationContext, otu_id: str) -> list[tuple[str, int]]:
    """Get an OTU's sequence ids and positions, ordered as Postgres would join them."""
    async with AsyncSession(ctx.pg) as session:
        return [
            (row.id, row.position)
            for row in (
                await session.execute(
                    select(SQLSequence.id, SQLSequence.position)
                    .where(SQLSequence.otu_id == otu_id)
                    .order_by(SQLSequence.position),
                )
            ).all()
        ]


class TestBackfillSequencePositions:
    @pytest.fixture
    async def copied_otu(self, ctx: MigrationContext, reference_id: int) -> list[str]:
        """Seed one OTU with three sequences and copy them into Postgres.

        Returns the sequence ids in the order Mongo returns them, which is the order
        the positions must reproduce.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_ordered", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_first", "seq_second", "seq_third"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_ordered"),
            )

        await copy_otus_and_sequences_to_postgres(ctx)

        return await _mongo_sequence_ids(ctx, "otu_ordered")

    async def test_assigns_mongo_order(
        self,
        ctx: MigrationContext,
        copied_otu: list[str],
    ):
        """Positions count off the OTU's sequences in Mongo's natural order."""
        await backfill_sequence_positions(ctx)

        assert await _get_positions(ctx, "otu_ordered") == [
            (sequence_id, position) for position, sequence_id in enumerate(copied_otu)
        ]

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        copied_otu: list[str],
    ):
        """A second run reads the same order and writes the same numbers."""
        await backfill_sequence_positions(ctx)
        first = await _get_positions(ctx, "otu_ordered")

        await backfill_sequence_positions(ctx)

        assert await _get_positions(ctx, "otu_ordered") == first

    async def test_repairs_a_mis_numbered_row(
        self,
        ctx: MigrationContext,
        copied_otu: list[str],
    ):
        """A row the dual-write mis-numbered before this ran is renumbered.

        A sequence created between the dual-write shipping and this backfill took
        ``MAX + 1`` over an OTU with no Postgres rows yet, and so wrongly claimed
        position zero. The backfill is authoritative and must overwrite it.
        """
        await backfill_sequence_positions(ctx)
        await _update_sequence_row(ctx, copied_otu[2], position=0)

        await backfill_sequence_positions(ctx)

        assert await _get_positions(ctx, "otu_ordered") == [
            (sequence_id, position) for position, sequence_id in enumerate(copied_otu)
        ]

    async def test_sequence_without_an_otu_row_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """A sequence whose parent OTU was never copied is a loud failure."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_uncopied", reference_id, "Cucumber mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_uncopied", "otu_uncopied"),
        )

        with pytest.raises(ValueError, match="no row in postgres"):
            await backfill_sequence_positions(ctx)


class TestCompareSequencePositions:
    @pytest.fixture
    async def positioned_otu(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ) -> list[str]:
        """Seed an OTU with three sequences, copy them, and assign their positions."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_ordered", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_first", "seq_second", "seq_third"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_ordered"),
            )

        await copy_otus_and_sequences_to_postgres(ctx)
        await backfill_sequence_positions(ctx)

        return await _mongo_sequence_ids(ctx, "otu_ordered")

    async def test_matching_order_passes(
        self,
        ctx: MigrationContext,
        positioned_otu: list[str],
    ):
        await compare_sequence_positions(ctx)

    async def test_is_read_only_and_repeatable(
        self,
        ctx: MigrationContext,
        positioned_otu: list[str],
    ):
        await compare_sequence_positions(ctx)
        await compare_sequence_positions(ctx)

    async def test_swapped_order_raises(
        self,
        ctx: MigrationContext,
        positioned_otu: list[str],
    ):
        """Two sequences holding each other's positions is drift."""
        await _update_sequence_row(ctx, positioned_otu[0], position=1)
        await _update_sequence_row(ctx, positioned_otu[1], position=0)

        with pytest.raises(ValueError, match="sequence order drift detected in 1 otus"):
            await compare_sequence_positions(ctx)

    async def test_null_position_raises(
        self,
        ctx: MigrationContext,
        positioned_otu: list[str],
    ):
        """An unbackfilled row is drift, not a row that quietly sorts last.

        Postgres orders nulls last on an ascending sort, so a null position would
        otherwise shuffle the sequence to the end of its OTU and pass unnoticed.
        """
        await _update_sequence_row(ctx, positioned_otu[2], position=None)

        with pytest.raises(ValueError, match="sequence order drift detected in 1 otus"):
            await compare_sequence_positions(ctx)
