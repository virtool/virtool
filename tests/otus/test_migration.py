"""Tests for the Mongo-to-Postgres OTU and sequence backfill, reconciliation and gate."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import pytest
from motor.motor_asyncio import AsyncIOMotorCollection
from sqlalchemy import Delete, Insert, delete, insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext
from virtool.otus.db import bulk_insert_otu_rows, otu_row_values, sequence_row_values
from virtool.otus.migration import (
    _compare_otu_sequence_order,
    compare_otu_and_sequence_stores,
    copy_otus_and_sequences_to_postgres,
    reconcile_otus_and_sequences,
    repair_string_otu_created_at,
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
        "last_indexed_version": None,
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
                    SELECT id, data, name, abbreviation, last_indexed_version,
                           reference_id, verified, version
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
                    SELECT id, data, otu_id, isolate_id, segment, position
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


async def _insert_sequence_row(
    ctx: MigrationContext,
    sequence_id: str,
    otu_id: str,
    position: int,
) -> None:
    """Insert a ``legacy_sequences`` row directly, as a dual-write would."""
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            insert(SQLSequence).values(
                **sequence_row_values(_sequence_doc(sequence_id, otu_id)),
                position=position,
            ),
        )
        await session.commit()


async def _delete_otu_row(ctx: MigrationContext, otu_id: str) -> None:
    """Delete a ``legacy_otus`` row directly, as an application dual-write would."""
    async with AsyncSession(ctx.pg) as session:
        await session.execute(delete(SQLOTU).where(SQLOTU.id == otu_id))
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


def _count_sequence_deletes(execute) -> int:
    """Count the ``legacy_sequences`` deletes a spied ``AsyncSession.execute`` ran.

    The spy is on the unbound method, so the session is the first recorded argument and
    the statement the second.
    """
    return sum(
        isinstance(statement := call.args[1], Delete)
        and statement.table.name == "legacy_sequences"
        for call in execute.call_args_list
    )


def _count_sequence_inserts(execute) -> int:
    """Count the ``legacy_sequences`` inserts a spied ``AsyncSession.execute`` ran.

    See :func:`_count_sequence_deletes`.
    """
    return sum(
        isinstance(statement := call.args[1], Insert)
        and statement.table.name == "legacy_sequences"
        for call in execute.call_args_list
    )


class TestReconcileOtusAndSequences:
    @pytest.fixture
    async def drifted_otu(self, ctx: MigrationContext, reference_id: int) -> list[str]:
        """Seed one OTU with three sequences and copy them into Postgres.

        The copy leaves every sequence unpositioned, which is itself one of the drifts
        the reconciliation repairs. Returns the sequence ids in Mongo's order.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_drifted", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_first", "seq_second", "seq_third"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_drifted"),
            )

        await copy_otus_and_sequences_to_postgres(ctx)

        return await _mongo_sequence_ids(ctx, "otu_drifted")

    async def test_rewrites_a_drifted_row(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """A row that has fallen behind its Mongo document is rewritten.

        The backfill inserts with ``ON CONFLICT (id) DO NOTHING`` and so cannot touch
        a row that already exists. The reconciliation upserts, which is the whole
        point of it.
        """
        await ctx.mongo.otus.update_one(
            {"_id": "otu_drifted"},
            {"$set": {"version": 4, "verified": False, "name": "Renamed virus"}},
        )

        await reconcile_otus_and_sequences(ctx)

        row = await _fetch_otu(ctx, "otu_drifted")

        assert row.name == "Renamed virus"
        assert row.verified is False
        assert row.version == 4
        assert row.data["name"] == "Renamed virus"
        assert row.data["version"] == 4

    async def test_repairs_a_microsecond_created_at(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """A ``created_at`` finer than Mongo can hold is floored to the millisecond.

        The bulk import path handed the same in-memory dict to Postgres and to Mongo
        before it truncated, so the row holds microseconds Mongo dropped. Rewriting
        the row from the Mongo document -- which only ever had the floored instant --
        is what repairs it.
        """
        document = {
            **_otu_doc("otu_imported", reference_id, "Imported virus"),
            "created_at": datetime(2025, 7, 2, 21, 18, 48, 420789),
        }

        await ctx.mongo.otus.insert_one(document)
        await copy_otus_and_sequences_to_postgres(ctx)
        await _update_otu_row(ctx, "otu_imported", data=document)

        assert (await _fetch_otu(ctx, "otu_imported")).data["created_at"] == (
            "2025-07-02T21:18:48.420789Z"
        )

        await reconcile_otus_and_sequences(ctx)

        assert (await _fetch_otu(ctx, "otu_imported")).data["created_at"] == (
            "2025-07-02T21:18:48.420000Z"
        )

    async def test_repairs_a_stale_last_indexed_version(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """An index stamp that only reached Mongo is written to the column and ``data``."""
        await ctx.mongo.otus.update_one(
            {"_id": "otu_drifted"},
            {"$set": {"last_indexed_version": 3}},
        )

        await reconcile_otus_and_sequences(ctx)

        row = await _fetch_otu(ctx, "otu_drifted")

        assert row.last_indexed_version == 3
        assert row.data["last_indexed_version"] == 3

    async def test_assigns_positions_in_mongo_order(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """Positions are re-derived from the order Mongo's cursor returns."""
        await reconcile_otus_and_sequences(ctx)

        assert await _get_positions(ctx, "otu_drifted") == [
            (sequence_id, position) for position, sequence_id in enumerate(drifted_otu)
        ]

    async def test_repairs_a_mis_numbered_position(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """Unlike the steady-state write path, this pass owns ``position``."""
        await reconcile_otus_and_sequences(ctx)
        await _update_sequence_row(ctx, drifted_otu[2], position=0)

        await reconcile_otus_and_sequences(ctx)

        assert await _get_positions(ctx, "otu_drifted") == [
            (sequence_id, position) for position, sequence_id in enumerate(drifted_otu)
        ]

    async def test_creates_a_row_the_backfill_never_wrote(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """An OTU with no row at all is inserted, not just repaired."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_uncopied", reference_id, "Potato virus Y"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_uncopied", "otu_uncopied"),
        )

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_otu(ctx, "otu_uncopied") is not None
        assert (await _fetch_sequence(ctx, "seq_uncopied")).position == 0

    async def test_deletes_a_sequence_mongo_no_longer_has(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """A sequence row orphaned by a revert is deleted, and the rest renumbered."""
        await ctx.mongo.sequences.delete_one({"_id": drifted_otu[1]})

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_sequence(ctx, drifted_otu[1]) is None
        assert await _get_positions(ctx, "otu_drifted") == [
            (drifted_otu[0], 0),
            (drifted_otu[2], 1),
        ]

    async def test_deletes_removed_sequences_in_chunks(
        self,
        ctx: MigrationContext,
        reference_id: int,
        mocker,
    ):
        """The rows to delete are chunked so their ids cannot exhaust the bind
        parameters.

        Each id binds one parameter and asyncpg refuses a statement carrying more than
        32767 of them, so a single OTU large enough would otherwise abort the whole
        revision. The chunk size is patched down rather than seeding an OTU with tens of
        thousands of sequences: five removed sequences over a chunk size of two exercise
        the same loop, including its short final chunk.
        """
        mocker.patch("virtool.otus.db._SEQUENCE_ID_CHUNK_SIZE", 2)

        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_pruned", reference_id, "Pepper mild mottle virus"),
        )

        for index in range(7):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(f"seq_{index}", "otu_pruned"),
            )

        await copy_otus_and_sequences_to_postgres(ctx)

        await ctx.mongo.sequences.delete_many(
            {"_id": {"$in": (await _mongo_sequence_ids(ctx, "otu_pruned"))[:5]}},
        )

        execute = mocker.spy(AsyncSession, "execute")

        await reconcile_otus_and_sequences(ctx)

        kept = await _mongo_sequence_ids(ctx, "otu_pruned")

        assert _count_sequence_deletes(execute) == 3
        assert await _get_positions(ctx, "otu_pruned") == [
            (sequence_id, position) for position, sequence_id in enumerate(kept)
        ]

    async def test_no_delete_is_issued_when_nothing_was_removed(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
        mocker,
    ):
        """An OTU whose sequences Mongo still has is not made to pay for a delete.

        The common case by far. The rows Mongo no longer accounts for are worked out
        before anything is deleted, so an OTU that has lost none issues no delete
        statement at all, however many sequences it has.
        """
        execute = mocker.spy(AsyncSession, "execute")

        await reconcile_otus_and_sequences(ctx)

        assert _count_sequence_deletes(execute) == 0
        assert await _get_positions(ctx, "otu_drifted") == [
            (sequence_id, position) for position, sequence_id in enumerate(drifted_otu)
        ]

    async def test_upserts_sequences_in_chunks(
        self,
        ctx: MigrationContext,
        reference_id: int,
        mocker,
    ):
        """An OTU's sequences are rewritten a chunk at a time, not a row at a time.

        A row per statement is a round trip per sequence, and every one of them is spent
        holding the OTU's row lock, so a large OTU would block dual-writes to itself for
        as long as it took to walk it. Chunking bounds the rows per statement instead --
        a statement carrying more bind parameters than asyncpg accepts would fail
        outright.

        The chunk size is patched down rather than seeding an OTU with thousands of
        sequences: five sequences over a chunk size of two exercise the same loop,
        including its short final chunk, and the positions must still count off in
        Mongo's order across the chunk boundaries.
        """
        mocker.patch("virtool.otus.db._SEQUENCE_ROW_CHUNK_SIZE", 2)

        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_chunked", reference_id, "Pepper mild mottle virus"),
        )

        for index in range(5):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(f"seq_{index}", "otu_chunked"),
            )

        await copy_otus_and_sequences_to_postgres(ctx)

        execute = mocker.spy(AsyncSession, "execute")

        await reconcile_otus_and_sequences(ctx)

        sequence_ids = await _mongo_sequence_ids(ctx, "otu_chunked")

        assert _count_sequence_inserts(execute) == 3
        assert await _get_positions(ctx, "otu_chunked") == [
            (sequence_id, position) for position, sequence_id in enumerate(sequence_ids)
        ]

    async def test_deletes_an_otu_mongo_no_longer_has(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """A deleted OTU takes its sequences with it through the cascade."""
        await ctx.mongo.otus.delete_one({"_id": "otu_drifted"})
        await ctx.mongo.sequences.delete_many({"otu_id": "otu_drifted"})

        await reconcile_otus_and_sequences(ctx)

        assert await _count(ctx, "legacy_otus") == 0
        assert await _count(ctx, "legacy_sequences") == 0

    async def test_otu_created_mid_run_is_not_deleted(
        self,
        ctx: MigrationContext,
        reference_id: int,
        drifted_otu: list[str],
        mocker,
    ):
        """An OTU the application creates mid-run must not be deleted as removed.

        The OTU id snapshot is taken up front, so an OTU dual-written after it is
        absent from the snapshot without ever having been removed from Mongo. A plain
        set difference would delete a live OTU and every sequence under it, which is
        why each candidate is re-read from Mongo before it is deleted.
        """
        await _insert_otu_row(ctx, "otu_dual_written", reference_id)

        real_find_one = AsyncIOMotorCollection.find_one

        async def find_one_after_dual_write(self, *args, **kwargs):
            if self.name == "otus":
                await ctx.mongo.otus.update_one(
                    {"_id": "otu_dual_written"},
                    {
                        "$setOnInsert": _otu_doc(
                            "otu_dual_written",
                            reference_id,
                            "Cucumber mosaic virus",
                        ),
                    },
                    upsert=True,
                )

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            find_one_after_dual_write,
        )

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_otu(ctx, "otu_dual_written") is not None

    async def test_otu_dual_written_mid_run_is_not_deleted(
        self,
        ctx: MigrationContext,
        reference_id: int,
        drifted_otu: list[str],
        mocker,
    ):
        """An OTU whose rows land in Postgres mid-run must not be deleted as removed.

        Every dual-write commits Postgres before Mongo, so a newly created OTU is a row
        without being a document for as long as the writer's Mongo commit takes to
        become visible. Re-reading the candidate from Mongo cannot settle that -- the
        document is not there to read yet -- so an OTU that had no row when the run
        started is never a delete candidate at all. Deleting it would take its sequences
        with it through the cascade.
        """
        dual_written = False

        real_find_one = AsyncIOMotorCollection.find_one

        async def dual_write_postgres_half(self, *args, **kwargs):
            nonlocal dual_written

            if self.name == "otus" and not dual_written:
                dual_written = True

                await _insert_otu_row(ctx, "otu_dual_written", reference_id)
                await _insert_sequence_row(
                    ctx,
                    "seq_dual_written",
                    "otu_dual_written",
                    position=0,
                )

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            dual_write_postgres_half,
        )

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_otu(ctx, "otu_dual_written") is not None
        assert await _fetch_sequence(ctx, "seq_dual_written") is not None

    async def test_sequence_dual_written_mid_run_is_not_deleted(
        self,
        ctx: MigrationContext,
        reference_id: int,
        drifted_otu: list[str],
        mocker,
    ):
        """A sequence dual-written mid-run must not be deleted as removed.

        ``create_sequence`` commits its sequence row and its OTU version bump to
        Postgres while its Mongo writes are still invisible, so the OTU's sequence read
        can miss a sequence whose row is already there. Deleting every row that read
        does not account for would destroy it.

        The row's ``version`` is what gives the lag away: it is one ahead of the
        document, so the OTU is deferred and reconciled once the Mongo write lands.
        """
        await _insert_sequence_row(
            ctx,
            "seq_dual_written",
            "otu_drifted",
            position=3,
        )
        await _update_otu_row(
            ctx,
            "otu_drifted",
            version=4,
            data={
                **_otu_doc("otu_drifted", reference_id, "Tobacco mosaic virus"),
                "version": 4,
            },
        )

        otu_reads = 0

        real_find_one = AsyncIOMotorCollection.find_one

        async def land_mongo_half_on_retry(self, *args, **kwargs):
            nonlocal otu_reads

            if self.name == "otus":
                otu_reads += 1

                if otu_reads == 2:
                    await ctx.mongo.sequences.insert_one(
                        _sequence_doc("seq_dual_written", "otu_drifted"),
                    )
                    await ctx.mongo.otus.update_one(
                        {"_id": "otu_drifted"},
                        {"$set": {"version": 4}},
                    )

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            land_mongo_half_on_retry,
        )

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_sequence(ctx, "seq_dual_written") is not None
        assert (await _fetch_otu(ctx, "otu_drifted")).version == 4
        assert await _get_positions(ctx, "otu_drifted") == [
            (sequence_id, position)
            for position, sequence_id in enumerate(
                await _mongo_sequence_ids(ctx, "otu_drifted"),
            )
        ]

    async def test_otu_removed_mid_run_is_not_recreated(
        self,
        ctx: MigrationContext,
        reference_id: int,
        mocker,
    ):
        """An OTU removed while the run is walking Mongo must not be resurrected.

        ``remove`` deletes the Postgres row before the Mongo document, so the run can
        read a document whose row is already gone. Re-inserting it would put the OTU
        back permanently: its id is in the run's Mongo id snapshot, so the delete pass
        never considers it a candidate.
        """
        for otu_id, name in (
            ("otu_reconciled", "Tobacco mosaic virus"),
            ("otu_removed", "Cucumber mosaic virus"),
        ):
            await ctx.mongo.otus.insert_one(_otu_doc(otu_id, reference_id, name))
            await ctx.mongo.sequences.insert_one(_sequence_doc(f"seq_{otu_id}", otu_id))

        await copy_otus_and_sequences_to_postgres(ctx)

        real_find_one = AsyncIOMotorCollection.find_one

        async def remove_postgres_half(self, *args, **kwargs):
            if self.name == "otus":
                await _delete_otu_row(ctx, "otu_removed")

            return await real_find_one(self, *args, **kwargs)

        mocker.patch.object(
            AsyncIOMotorCollection,
            "find_one",
            remove_postgres_half,
        )

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_otu(ctx, "otu_removed") is None
        assert await _fetch_sequence(ctx, "seq_otu_removed") is None
        assert await _fetch_otu(ctx, "otu_reconciled") is not None

    async def test_stamped_last_indexed_version_is_not_clobbered(
        self,
        ctx: MigrationContext,
        reference_id: int,
        drifted_otu: list[str],
    ):
        """An index stamp that has only reached Postgres survives the rewrite.

        Index finalization stamps ``last_indexed_version`` into both stores without
        bumping the OTU's ``version``, and commits Postgres first, so there is nothing
        else about the OTU to give the lag away. Rewriting ``data`` wholesale from a
        document that has not caught up would drop the stamp the index just wrote.

        The row is stamped in the column and in ``data``, as index finalization stamps
        it, and the rewrite has to preserve it in both.
        """
        await _update_otu_row(
            ctx,
            "otu_drifted",
            last_indexed_version=3,
            data={
                **_otu_doc("otu_drifted", reference_id, "Tobacco mosaic virus"),
                "last_indexed_version": 3,
            },
        )

        await reconcile_otus_and_sequences(ctx)

        row = await _fetch_otu(ctx, "otu_drifted")

        assert row.last_indexed_version == 3
        assert row.data["last_indexed_version"] == 3

    async def test_row_left_ahead_of_mongo_is_repaired(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """A row whose version never stops being ahead of Mongo is drift, and repaired.

        A dual-write whose Mongo commit never landed leaves the Postgres row a version
        ahead for good. Waiting on a Mongo write that is not coming would strand the
        row, so Mongo is taken as authoritative once the retries are exhausted.
        """
        await _update_otu_row(ctx, "otu_drifted", version=9, name="Wrong name")

        await reconcile_otus_and_sequences(ctx)

        row = await _fetch_otu(ctx, "otu_drifted")

        assert row.version == 3
        assert row.name == "Tobacco mosaic virus"

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        drifted_otu: list[str],
    ):
        """A second run reads the same documents and writes the same values."""
        await reconcile_otus_and_sequences(ctx)

        first_otu = await _fetch_otu(ctx, "otu_drifted")
        first_positions = await _get_positions(ctx, "otu_drifted")

        await reconcile_otus_and_sequences(ctx)

        assert await _fetch_otu(ctx, "otu_drifted") == first_otu
        assert await _get_positions(ctx, "otu_drifted") == first_positions
        assert await _count(ctx, "legacy_otus") == 1
        assert await _count(ctx, "legacy_sequences") == 3

    async def test_unresolvable_reference_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """Every OTU belongs to a reference, so an unresolvable one is loud."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_ghost", 999999, "Ghost virus"),
        )

        with pytest.raises(ValueError, match="which does not exist in postgres"):
            await reconcile_otus_and_sequences(ctx)


class TestRepairStringOtuCreatedAt:
    @pytest.fixture
    async def cloned_otu(self, ctx: MigrationContext, reference_id: int) -> None:
        """Seed an OTU whose Mongo ``created_at`` is a string, as a legacy clone's is,
        and reconcile it into Postgres.
        """
        await ctx.mongo.otus.insert_one(
            {
                **_otu_doc("otu_cloned", reference_id, "Cucumber mosaic virus"),
                "created_at": _CREATED_AT_JSON,
            },
        )

        await reconcile_otus_and_sequences(ctx)

    async def test_string_is_rewritten_as_a_datetime(
        self,
        ctx: MigrationContext,
        cloned_otu: None,
    ):
        """The string becomes the datetime it means, in both stores."""
        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})
        row = await _fetch_otu(ctx, "otu_cloned")

        assert document["created_at"] == _CREATED_AT
        assert row.data["created_at"] == _CREATED_AT_JSON

    async def test_repaired_otu_passes_the_gate(
        self,
        ctx: MigrationContext,
        cloned_otu: None,
    ):
        """The drift the gate fails the cutover on is the drift the repair clears."""
        with pytest.raises(ValueError, match="store drift detected in 1 otus"):
            await compare_otu_and_sequence_stores(ctx)

        await repair_string_otu_created_at(ctx)

        await compare_otu_and_sequence_stores(ctx)

    async def test_sub_millisecond_string_is_floored(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """A string finer than Mongo can hold is floored before it is written.

        BSON holds a datetime as int64 milliseconds. Writing the string's full
        precision would leave Mongo holding an instant the ``data`` column does not,
        which is the drift this repair exists to clear.
        """
        await ctx.mongo.otus.insert_one(
            {
                **_otu_doc("otu_precise", reference_id, "Tobacco mosaic virus"),
                "created_at": "2025-07-02T21:18:48.420789Z",
            },
        )

        await reconcile_otus_and_sequences(ctx)
        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_precise"})
        row = await _fetch_otu(ctx, "otu_precise")

        assert document["created_at"] == _CREATED_AT
        assert row.data["created_at"] == _CREATED_AT_JSON

        await compare_otu_and_sequence_stores(ctx)

    async def test_datetime_otu_is_untouched(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """An OTU that already holds a datetime is left exactly as it is."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_sound", reference_id, "Tobacco mosaic virus"),
        )

        await reconcile_otus_and_sequences(ctx)

        row_before = await _fetch_otu(ctx, "otu_sound")

        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_sound"})

        assert document["created_at"] == _CREATED_AT
        assert (await _fetch_otu(ctx, "otu_sound")).data == row_before.data

    async def test_string_without_an_offset_is_read_as_utc(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """An unqualified datetime is UTC, as the convention says it is."""
        await ctx.mongo.otus.insert_one(
            {
                **_otu_doc("otu_unqualified", reference_id, "Tobacco mosaic virus"),
                "created_at": "2025-07-02T21:18:48.420000",
            },
        )

        await reconcile_otus_and_sequences(ctx)
        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_unqualified"})

        assert document["created_at"] == _CREATED_AT

    async def test_non_utc_offset_raises_before_anything_is_written(
        self,
        ctx: MigrationContext,
        cloned_otu: None,
        reference_id: int,
    ):
        """A string this cannot read stops the repair rather than being guessed at.

        ``arrow`` strips an offset instead of applying it, so reading such a string as
        naive UTC would file it two hours from the instant it names. Nothing is written
        at all: the strings are all parsed before the first store is touched, so the
        readable OTUs of a store holding an unreadable one are not left half repaired.
        """
        await ctx.mongo.otus.insert_one(
            {
                **_otu_doc("otu_offset", reference_id, "Tobacco mosaic virus"),
                "created_at": "2025-07-02T21:18:48.420000+02:00",
            },
        )

        with pytest.raises(ValueError, match="non-utc offset"):
            await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})

        assert document["created_at"] == _CREATED_AT_JSON

    async def test_a_failed_postgres_write_leaves_the_otu_repairable(
        self,
        ctx: MigrationContext,
        cloned_otu: None,
        mocker,
    ):
        """An interrupted repair keeps the string that makes the OTU findable.

        The string is the only thing that puts an OTU in the candidate query. Landing
        the Mongo write ahead of the Postgres one would take it away the moment the
        write committed, and an OTU whose row never got written would then be drifted,
        unfindable and unrepairable. The Mongo write commits after Postgres, so a failed
        Postgres write takes the Mongo write down with it.
        """
        mocker.patch(
            "virtool.otus.migration.update",
            side_effect=OSError("postgres is gone"),
        )

        with pytest.raises(OSError, match="postgres is gone"):
            await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})

        assert document["created_at"] == _CREATED_AT_JSON

        mocker.stopall()

        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})

        assert document["created_at"] == _CREATED_AT
        assert (await _fetch_otu(ctx, "otu_cloned")).data["created_at"] == (
            _CREATED_AT_JSON
        )

    async def test_is_idempotent(self, ctx: MigrationContext, cloned_otu: None):
        """A second run finds nothing left to repair and changes nothing."""
        await repair_string_otu_created_at(ctx)
        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})
        row = await _fetch_otu(ctx, "otu_cloned")

        assert document["created_at"] == _CREATED_AT
        assert row.data["created_at"] == _CREATED_AT_JSON

    async def test_otu_without_a_row_is_repaired_in_mongo(
        self,
        ctx: MigrationContext,
        cloned_otu: None,
    ):
        """An OTU whose row is being deleted right now is still repaired in Mongo.

        Postgres is never behind Mongo, so a document with no row is one a concurrent
        delete has already removed from Postgres. The repair has no row to rewrite and
        must not fail over it.
        """
        await _delete_otu_row(ctx, "otu_cloned")

        await repair_string_otu_created_at(ctx)

        document = await ctx.mongo.otus.find_one({"_id": "otu_cloned"})

        assert document["created_at"] == _CREATED_AT


class TestCompareOtuAndSequenceStores:
    @pytest.fixture
    async def matching_stores(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ) -> None:
        """Seed one OTU and one sequence and reconcile both into Postgres."""
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_matched", reference_id, "Tobacco mosaic virus"),
        )
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_matched", "otu_matched"),
        )

        await reconcile_otus_and_sequences(ctx)

    async def test_matching_stores_pass(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """Matching stores pass, including the OTU's datetime ``created_at``.

        A ``datetime`` cannot survive the JSONB round trip as a ``datetime``: it is
        stored and read back as an ISO string. The read path parses it back, and the
        gate must not read that round trip as drift.
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

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_missing_from_postgres_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A sequence Postgres never got is missing from its OTU's order too."""
        await ctx.mongo.sequences.insert_one(
            _sequence_doc("seq_not_written", "otu_matched"),
        )

        with pytest.raises(ValueError, match="0 otus, 1 sequences and 1 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_missing_from_mongo_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A Postgres row whose Mongo document was deleted is drift, not an aside."""
        await ctx.mongo.otus.delete_one({"_id": "otu_matched"})

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_missing_from_mongo_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        await ctx.mongo.sequences.delete_one({"_id": "seq_matched"})

        with pytest.raises(ValueError, match="0 otus, 1 sequences and 1 otu"):
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

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_document_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A ``data`` field with no promoted column of its own is still drift.

        The gate asserts the read contract, so a document the read path cannot recover
        faithfully fails even when every promoted column agrees.
        """
        await ctx.mongo.otus.update_one(
            {"_id": "otu_matched"},
            {"$set": {"isolates": []}},
        )

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_column_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A promoted column that disagrees with an otherwise-matching ``data``."""
        await _update_otu_row(ctx, "otu_matched", name="Wrong name")

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_otu_last_indexed_version_column_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """A ``last_indexed_version`` column that disagrees with the document.

        The value is held in the column and in ``data``, and index builds read the
        column, so a column that has drifted from the document it mirrors would send
        the wrong OTUs to the next build. The gate has to fail on it even though the
        document the read path recovers is still faithful.
        """
        await _update_otu_row(ctx, "otu_matched", last_indexed_version=3)

        with pytest.raises(ValueError, match="1 otus, 0 sequences and 0 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_column_drift_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        await _update_sequence_row(ctx, "seq_matched", segment="RNA2")

        with pytest.raises(ValueError, match="0 otus, 1 sequences and 0 otu"):
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

        await reconcile_otus_and_sequences(ctx)

        await _update_otu_row(ctx, "otu_matched", verified=False)
        await _update_otu_row(ctx, "otu_second", version=99)
        await _update_sequence_row(ctx, "seq_second", isolate_id="isolate_wrong")

        with pytest.raises(ValueError, match="2 otus, 1 sequences and 0 otu"):
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

    async def test_pending_mongo_write_is_not_drift(
        self,
        ctx: MigrationContext,
        matching_stores: None,
        mocker,
    ):
        """A dual-write whose Postgres commit landed but whose Mongo write has not is
        not drift.

        ``both_transactions`` commits Postgres inside the still-open Mongo transaction,
        so the row is visible here while the document it was written from is not. Both
        passes therefore read the *same* stale document, which is what separates this
        from :meth:`test_row_written_mid_run_is_not_drift`: re-reading the candidate
        cannot clear it, because there is nothing newer in Mongo to re-read yet. Only
        reading both stores again, after the write has landed, can.
        """
        document = await ctx.mongo.otus.find_one({"_id": "otu_matched"})
        version = document["version"] + 1

        await _update_otu_row(
            ctx,
            "otu_matched",
            data={**document, "version": version},
            version=version,
        )

        async def land_the_pending_mongo_write(_: float) -> None:
            await ctx.mongo.otus.update_one(
                {"_id": "otu_matched"},
                {"$set": {"version": version}},
            )

        sleep = mocker.patch(
            "virtool.otus.migration.asyncio.sleep",
            side_effect=land_the_pending_mongo_write,
        )

        await compare_otu_and_sequence_stores(ctx)

        sleep.assert_awaited_once()

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

        await reconcile_otus_and_sequences(ctx)

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

        await reconcile_otus_and_sequences(ctx)

        await compare_otu_and_sequence_stores(ctx)

    async def test_swapped_sequence_order_raises(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """Two sequences holding each other's positions is drift.

        Stored history diffs address an isolate's sequences by list index, so a
        reordered join applies each change to the wrong sequence.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_ordered", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_first", "seq_second"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_ordered"),
            )

        await reconcile_otus_and_sequences(ctx)

        sequence_ids = await _mongo_sequence_ids(ctx, "otu_ordered")

        await _update_sequence_row(ctx, sequence_ids[0], position=1)
        await _update_sequence_row(ctx, sequence_ids[1], position=0)

        with pytest.raises(ValueError, match="0 otus, 0 sequences and 1 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_null_sequence_position_raises(
        self,
        ctx: MigrationContext,
        matching_stores: None,
    ):
        """An unreconciled row is drift, not a row that quietly sorts last.

        Postgres orders nulls last on an ascending sort, so a null position would
        otherwise shuffle the sequence to the end of its OTU and pass unnoticed.
        """
        await _update_sequence_row(ctx, "seq_matched", position=None)

        with pytest.raises(ValueError, match="0 otus, 0 sequences and 1 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_duplicate_sequence_positions_raise(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """Two sequences of one OTU sharing a position is drift.

        Nothing in the schema forbids the collision, so the order of the pair is left
        to the query plan. The gate must fail on it rather than sort around it and
        pass whenever the plan of the day happens to agree with Mongo.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_collided", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_first", "seq_second"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_collided"),
            )

        await reconcile_otus_and_sequences(ctx)

        sequence_ids = await _mongo_sequence_ids(ctx, "otu_collided")

        await _update_sequence_row(ctx, sequence_ids[1], position=0)

        with pytest.raises(ValueError, match="0 otus, 0 sequences and 1 otu"):
            await compare_otu_and_sequence_stores(ctx)

    async def test_sequence_order_is_deterministic(
        self,
        ctx: MigrationContext,
        reference_id: int,
    ):
        """Rows sharing a position come back ordered by id, not in plan order.

        Ordering on ``position`` alone leaves colliding rows wherever the plan puts
        them, which on a table this small is the order they were written in --
        ``seq_zulu`` before ``seq_alpha``. The tie-break makes the read reproducible,
        so the check can neither pass nor fail by luck.
        """
        await ctx.mongo.otus.insert_one(
            _otu_doc("otu_collided", reference_id, "Tobacco mosaic virus"),
        )

        for sequence_id in ("seq_zulu", "seq_alpha"):
            await ctx.mongo.sequences.insert_one(
                _sequence_doc(sequence_id, "otu_collided"),
            )

        await reconcile_otus_and_sequences(ctx)

        await _update_sequence_row(ctx, "seq_zulu", position=0)
        await _update_sequence_row(ctx, "seq_alpha", position=0)

        async with AsyncSession(ctx.pg) as session:
            report = await _compare_otu_sequence_order(ctx, session, "otu_collided")

        assert report == {
            "otu_id": "otu_collided",
            "issue": "sequences sharing a position",
            "positions": [0],
            "sequence_ids": ["seq_alpha", "seq_zulu"],
        }
