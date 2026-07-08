"""Tests for the purge orphaned references migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_0uwpffz8adx0_purge_orphaned_references import upgrade
from virtool.migration.ctx import MigrationContext

# ``91b32f49a8b2`` (add reference_id columns) is the alembic revision the purge
# runs immediately after, and brings up every table it touches.
PIN = "91b32f49a8b2"


@pytest.fixture
def now() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def user_id(
    ctx: MigrationContext,
    apply_alembic: Callable,
    now: datetime,
) -> int:
    """Bring up the schema the purge touches and create a history/analysis author."""
    await asyncio.to_thread(apply_alembic, PIN)

    async with AsyncSession(ctx.pg) as session:
        uid = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'author', 'legacy_author', true, '', false,
                        false, :now, :password, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": now, "password": b"hashed"},
            )
        ).scalar_one()
        await session.commit()

    return uid


def history_doc(reference: str, change_id: str) -> dict:
    """Build a minimal Mongo history document keyed to a reference."""
    return {"_id": change_id, "reference": {"id": reference}}


def otu_doc(reference: str, otu_id: str) -> dict:
    """Build a minimal Mongo otu document keyed to a reference."""
    return {"_id": otu_id, "reference": {"id": reference}, "name": "OTU"}


def sequence_doc(reference: str, sequence_id: str) -> dict:
    """Build a minimal Mongo sequence document keyed to a reference."""
    return {"_id": sequence_id, "reference": {"id": reference}, "sequence": "ATGC"}


def index_doc(reference: str, index_id: str) -> dict:
    """Build a minimal Mongo index document keyed to a reference."""
    return {"_id": index_id, "reference": {"id": reference}, "version": 1}


async def insert_history(
    session: AsyncSession,
    *,
    legacy_id: str,
    reference: str,
    user_id: int,
    now: datetime,
) -> None:
    """Insert a legacy_history row and its diff, mirroring the copied Mongo doc."""
    history_id = (
        await session.execute(
            text("""
                INSERT INTO legacy_history (
                    legacy_id, created_at, description, method_name, user_id,
                    otu, otu_name, reference
                )
                VALUES (
                    :legacy_id, :now, 'desc', 'edit', :user_id,
                    'otu', 'OTU', :reference
                )
                RETURNING id
            """),
            {
                "legacy_id": legacy_id,
                "now": now,
                "user_id": user_id,
                "reference": reference,
            },
        )
    ).scalar_one()

    await session.execute(
        text("""
            INSERT INTO legacy_history_diff (change_id, history_id, diff)
            VALUES (:change_id, :history_id, '{}'::jsonb)
        """),
        {"change_id": legacy_id, "history_id": history_id},
    )


async def insert_analysis(
    session: AsyncSession,
    *,
    legacy_id: str,
    reference: str,
    user_id: int,
    now: datetime,
) -> None:
    """Insert an analysis row recording the reference it ran against."""
    await session.execute(
        text("""
            INSERT INTO analyses (
                legacy_id, created_at, updated_at, workflow, ready,
                sample, reference, "index", user_id
            )
            VALUES (
                :legacy_id, :now, :now, 'pathoscope', true,
                'sample', :reference, 'index', :user_id
            )
        """),
        {
            "legacy_id": legacy_id,
            "now": now,
            "reference": reference,
            "user_id": user_id,
        },
    )


@pytest.fixture
async def seeded(ctx: MigrationContext, user_id: int, now: datetime) -> int:
    """Seed one orphaned reference (``gone``) and one live reference (``live``).

    ``gone`` has no ``references`` document but retains history, otus, and
    sequences; ``live`` is intact. Returns the author ``user_id``.
    """
    await ctx.mongo.references.insert_one({"_id": "live"})

    await ctx.mongo.history.insert_many(
        [
            history_doc("gone", "gone.1"),
            history_doc("gone", "gone.2"),
            history_doc("live", "live.1"),
        ],
    )
    await ctx.mongo.otus.insert_many(
        [
            otu_doc("gone", "otu_gone_1"),
            otu_doc("gone", "otu_gone_2"),
            otu_doc("live", "otu_live"),
        ],
    )
    await ctx.mongo.sequences.insert_many(
        [
            sequence_doc("gone", "seq_gone_1"),
            sequence_doc("gone", "seq_gone_2"),
            sequence_doc("live", "seq_live"),
        ],
    )
    await ctx.mongo.indexes.insert_many(
        [
            index_doc("gone", "index_gone"),
            index_doc("live", "index_live"),
        ],
    )

    async with AsyncSession(ctx.pg) as session:
        for legacy_id, reference in (
            ("gone.1", "gone"),
            ("gone.2", "gone"),
            ("live.1", "live"),
        ):
            await insert_history(
                session,
                legacy_id=legacy_id,
                reference=reference,
                user_id=user_id,
                now=now,
            )
        await session.commit()

    return user_id


class TestPurgeOrphanedReferences:
    """Tests for the purge_orphaned_references upgrade."""

    @pytest.mark.usefixtures("seeded")
    async def test_archives_and_deletes_orphaned_otus_sequences_and_indexes(
        self,
        ctx: MigrationContext,
    ):
        """Orphaned otus/sequences/indexes move to the deleted_* collections."""
        await upgrade(ctx)

        assert await ctx.mongo.otus.distinct("_id") == ["otu_live"]
        assert sorted(await ctx.mongo.deleted_otus.distinct("_id")) == [
            "otu_gone_1",
            "otu_gone_2",
        ]
        assert await ctx.mongo.sequences.distinct("_id") == ["seq_live"]
        assert sorted(await ctx.mongo.deleted_sequences.distinct("_id")) == [
            "seq_gone_1",
            "seq_gone_2",
        ]
        assert await ctx.mongo.indexes.distinct("_id") == ["index_live"]
        assert await ctx.mongo.deleted_indexes.distinct("_id") == ["index_gone"]

    @pytest.mark.usefixtures("seeded")
    async def test_deletes_orphaned_legacy_history_rows_and_diffs(
        self,
        ctx: MigrationContext,
    ):
        """Orphaned legacy_history rows and their diffs are deleted from Postgres."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            references = (
                (await session.execute(text("SELECT reference FROM legacy_history")))
                .scalars()
                .all()
            )
            diffs = (
                (
                    await session.execute(
                        text("SELECT change_id FROM legacy_history_diff"),
                    )
                )
                .scalars()
                .all()
            )

        assert references == ["live"]
        assert diffs == ["live.1"]

    @pytest.mark.usefixtures("seeded")
    async def test_leaves_mongo_history_intact(self, ctx: MigrationContext):
        """The Mongo history collection is untouched; it doubles as the archive."""
        await upgrade(ctx)

        assert sorted(await ctx.mongo.history.distinct("_id")) == [
            "gone.1",
            "gone.2",
            "live.1",
        ]

    async def test_aborts_when_analysis_depends_on_orphan(
        self,
        ctx: MigrationContext,
        seeded: int,
        now: datetime,
    ):
        """An analysis referencing an orphan aborts the purge before any deletion."""
        async with AsyncSession(ctx.pg) as session:
            await insert_analysis(
                session,
                legacy_id="analysis_1",
                reference="gone",
                user_id=seeded,
                now=now,
            )
            await session.commit()

        with pytest.raises(ValueError, match="analysis dependents"):
            await upgrade(ctx)

        assert sorted(await ctx.mongo.otus.distinct("_id")) == [
            "otu_gone_1",
            "otu_gone_2",
            "otu_live",
        ]

        async with AsyncSession(ctx.pg) as session:
            surviving = (
                (
                    await session.execute(
                        text(
                            "SELECT legacy_id FROM legacy_history "
                            "WHERE reference = 'gone' ORDER BY legacy_id",
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert surviving == ["gone.1", "gone.2"]

    @pytest.mark.usefixtures("user_id")
    async def test_ignores_documents_without_reference_id(
        self,
        ctx: MigrationContext,
    ):
        """A null or missing reference.id is never treated as an orphan."""
        await ctx.mongo.references.insert_one({"_id": "live"})
        await ctx.mongo.otus.insert_many(
            [
                otu_doc("live", "otu_live"),
                {"_id": "otu_null_ref", "reference": {"id": None}},
                {"_id": "otu_no_ref"},
            ],
        )

        await upgrade(ctx)

        assert sorted(await ctx.mongo.otus.distinct("_id")) == [
            "otu_live",
            "otu_no_ref",
            "otu_null_ref",
        ]
        assert await ctx.mongo.deleted_otus.distinct("_id") == []

    async def test_no_orphans_is_noop(
        self,
        ctx: MigrationContext,
        now: datetime,
        user_id: int,
    ):
        """With every reference intact, nothing is archived or deleted."""
        await ctx.mongo.references.insert_one({"_id": "live"})
        await ctx.mongo.history.insert_one(history_doc("live", "live.1"))
        await ctx.mongo.otus.insert_one(otu_doc("live", "otu_live"))

        async with AsyncSession(ctx.pg) as session:
            await insert_history(
                session,
                legacy_id="live.1",
                reference="live",
                user_id=user_id,
                now=now,
            )
            await session.commit()

        await upgrade(ctx)

        assert await ctx.mongo.otus.distinct("_id") == ["otu_live"]
        assert await ctx.mongo.deleted_otus.distinct("_id") == []

        async with AsyncSession(ctx.pg) as session:
            references = (
                (await session.execute(text("SELECT reference FROM legacy_history")))
                .scalars()
                .all()
            )

        assert references == ["live"]

    @pytest.mark.usefixtures("seeded")
    async def test_idempotent(self, ctx: MigrationContext):
        """Re-running the purge leaves the same state and raises no error."""
        await upgrade(ctx)
        await upgrade(ctx)

        assert await ctx.mongo.otus.distinct("_id") == ["otu_live"]
        assert sorted(await ctx.mongo.deleted_otus.distinct("_id")) == [
            "otu_gone_1",
            "otu_gone_2",
        ]

        async with AsyncSession(ctx.pg) as session:
            references = (
                (await session.execute(text("SELECT reference FROM legacy_history")))
                .scalars()
                .all()
            )

        assert references == ["live"]
