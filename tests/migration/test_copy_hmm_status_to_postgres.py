"""Tests for the copy hmm status to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_ld2t6tbwulbd_copy_hmm_status_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.hmm.sql import HMM_STATUS_ID
from virtool.migration.ctx import MigrationContext


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def apply_table(ctx: MigrationContext, apply_alembic: Callable) -> None:
    """Create the ``legacy_hmm_status`` table the backfill writes into."""
    await asyncio.to_thread(apply_alembic, required_alembic_revision)


def make_release(release_id: int = 1) -> dict:
    """Create an HMM release subdocument for testing."""
    return {
        "id": release_id,
        "name": "v1.0",
        "body": "notes",
        "filename": "annotations.json.gz",
        "html_url": "https://example.com/release",
        "size": 1234,
        "newer": True,
    }


def make_installed(release_id: int = 1) -> dict:
    """Create an installed-release subdocument for testing."""
    return {
        **make_release(release_id),
        "ready": True,
        "user": {"id": "bob"},
    }


class TestUpgrade:
    @pytest.mark.usefixtures("apply_table")
    async def test_field_fidelity(self, ctx: MigrationContext):
        """Scalar and subdocument fields map straight across."""
        release = make_release()
        installed = make_installed()

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": ["boom"],
                "installed": installed,
                "release": release,
                "task": None,
                "updates": [installed],
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT id, errors, release, installed, task_id, updates "
                        "FROM legacy_hmm_status WHERE id = 1",
                    ),
                )
            ).one()

        assert row.id == HMM_STATUS_ID
        assert row.errors == ["boom"]
        assert row.release == release
        assert row.installed == installed
        assert row.task_id is None
        assert row.updates == [installed]

    @pytest.mark.usefixtures("apply_table")
    async def test_installed_none(self, ctx: MigrationContext):
        """A ``None`` installed field is written as NULL."""
        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": [],
                "installed": None,
                "release": None,
                "task": None,
                "updates": [],
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT installed, release, errors, updates "
                        "FROM legacy_hmm_status WHERE id = 1",
                    ),
                )
            ).one()

        assert row.installed is None
        assert row.release is None
        assert row.errors == []
        assert row.updates == []

    @pytest.mark.usefixtures("apply_table")
    async def test_installed_true_resolves_to_first_update(
        self,
        ctx: MigrationContext,
    ):
        """The legacy boolean ``installed=True`` resolves to ``updates[0]``."""
        first = make_installed(1)
        second = make_installed(2)

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": [],
                "installed": True,
                "release": make_release(2),
                "task": None,
                "updates": [first, second],
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text("SELECT installed FROM legacy_hmm_status WHERE id = 1"),
                )
            ).scalar_one()

        assert stored == first

    @pytest.mark.usefixtures("apply_table")
    async def test_installed_true_without_updates_raises(
        self,
        ctx: MigrationContext,
    ):
        """``installed=True`` with no updates aborts loudly."""
        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": [],
                "installed": True,
                "release": None,
                "task": None,
                "updates": [],
            },
        )

        with pytest.raises(ValueError, match="installed=True but no updates"):
            await upgrade(ctx)

    @pytest.mark.usefixtures("apply_table")
    async def test_task_id_mapping(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """A ``task`` reference maps to the ``task_id`` foreign key."""
        async with AsyncSession(ctx.pg) as session:
            task_id = (
                await session.execute(
                    text(
                        "INSERT INTO tasks (created_at, type, complete) "
                        "VALUES (:now, 'install_hmms', false) RETURNING id",
                    ),
                    {"now": static_datetime},
                )
            ).scalar_one()
            await session.commit()

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": [],
                "installed": None,
                "release": None,
                "task": {"id": task_id},
                "updates": [],
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text("SELECT task_id FROM legacy_hmm_status WHERE id = 1"),
                )
            ).scalar_one()

        assert stored == task_id

    @pytest.mark.usefixtures("apply_table")
    async def test_idempotent_rerun_reconciles(self, ctx: MigrationContext):
        """Re-running upserts the singleton rather than failing or duplicating."""
        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": ["stale"],
                "installed": None,
                "release": None,
                "task": None,
                "updates": [],
            },
        )

        await upgrade(ctx)

        await ctx.mongo.status.update_one(
            {"_id": "hmm"},
            {"$set": {"errors": ["fresh"]}},
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (
                    await session.execute(
                        text("SELECT errors FROM legacy_hmm_status"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == [["fresh"]]

    @pytest.mark.usefixtures("apply_table")
    async def test_missing_singleton_is_noop(self, ctx: MigrationContext):
        """An absent status singleton leaves the table empty."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(
                    text("SELECT COUNT(*) FROM legacy_hmm_status"),
                )
            ).scalar_one()

        assert count == 0
