"""Tests for the backfill sample uploads to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_n03aryu6frku_backfill_sample_uploads_to_postgres import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext
from virtool.samples.sql import SQLLegacySample, SQLSampleUpload
from virtool.uploads.sql import SQLUpload
from virtool.utils import timestamp


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Apply alembic to head and seed a user, returning its id."""
    await asyncio.to_thread(apply_alembic, "head")

    async with AsyncSession(ctx.pg) as session:
        user_id = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'testuser', 'legacy_user', true, '', false,
                        false, :now, :password, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "password": b"hashed_password"},
            )
        ).scalar_one()
        await session.commit()

    return user_id


async def insert_sample(
    session: AsyncSession,
    legacy_id: str,
    user_id: int,
    created_at: datetime,
) -> int:
    """Insert a ``legacy_samples`` row and return its integer primary key."""
    sample = SQLLegacySample(
        legacy_id=legacy_id,
        name=legacy_id,
        library_type="normal",
        created_at=created_at,
        user_id=user_id,
    )
    session.add(sample)
    await session.flush()
    sample_pk = sample.id
    await session.commit()

    return sample_pk


async def insert_upload(
    session: AsyncSession,
    name_on_disk: str,
    user_id: int,
    created_at: datetime,
) -> int:
    """Insert an ``uploads`` row and return its integer primary key."""
    upload = SQLUpload(
        name=name_on_disk,
        name_on_disk=name_on_disk,
        ready=True,
        removed=False,
        reserved=True,
        user_id=user_id,
        created_at=created_at,
    )
    session.add(upload)
    await session.flush()
    upload_pk = upload.id
    await session.commit()

    return upload_pk


def make_sample_document(sample_id: str, uploads: list[int]) -> dict:
    """Build a minimal Mongo sample document carrying an ``uploads`` array."""
    return {
        "_id": sample_id,
        "name": sample_id,
        "uploads": [{"id": upload_id} for upload_id in uploads],
    }


async def get_rows(session: AsyncSession, legacy_id: str) -> list[SQLSampleUpload]:
    """Return the ``sample_uploads`` rows for a sample, ordered by index."""
    return list(
        (
            await session.execute(
                select(SQLSampleUpload)
                .where(SQLSampleUpload.sample == legacy_id)
                .order_by(SQLSampleUpload.index),
            )
        )
        .scalars()
        .all(),
    )


class TestUpgrade:
    async def test_writes_rows_in_order(
        self,
        ctx: MigrationContext,
        setup: int,
        static_datetime: datetime,
    ):
        """Each upload becomes a row with its array position preserved as index."""
        async with AsyncSession(ctx.pg) as session:
            sample_pk = await insert_sample(session, "paired", setup, static_datetime)
            left = await insert_upload(session, "reads_1.fq.gz", setup, static_datetime)
            right = await insert_upload(
                session, "reads_2.fq.gz", setup, static_datetime
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document("paired", [left, right]),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = await get_rows(session, "paired")

        assert [(row.sample_id, row.upload_id, row.index) for row in rows] == [
            (sample_pk, left, 0),
            (sample_pk, right, 1),
        ]

    async def test_missing_sample_raises(
        self,
        ctx: MigrationContext,
        setup: int,
        static_datetime: datetime,
    ):
        """A sample with uploads but no legacy_samples row aborts the migration."""
        async with AsyncSession(ctx.pg) as session:
            upload_id = await insert_upload(
                session,
                "reads_1.fq.gz",
                setup,
                static_datetime,
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document("orphan", [upload_id]),
        )

        with pytest.raises(ValueError, match="no legacy_samples row"):
            await upgrade(ctx)

    async def test_missing_upload_skipped(
        self,
        ctx: MigrationContext,
        setup: int,
        static_datetime: datetime,
    ):
        """An upload id absent from postgres is skipped while the rest are written."""
        async with AsyncSession(ctx.pg) as session:
            await insert_sample(session, "partial", setup, static_datetime)
            present = await insert_upload(
                session,
                "reads_1.fq.gz",
                setup,
                static_datetime,
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document("partial", [999999, present]),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = await get_rows(session, "partial")

        assert [(row.upload_id, row.index) for row in rows] == [(present, 1)]

    async def test_skips_sample_without_uploads(
        self,
        ctx: MigrationContext,
        setup: int,
        static_datetime: datetime,
    ):
        """A sample with an empty or absent uploads array writes no rows."""
        async with AsyncSession(ctx.pg) as session:
            await insert_sample(session, "empty", setup, static_datetime)

        await ctx.mongo.samples.insert_one(
            {"_id": "empty", "name": "empty", "uploads": []},
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = await get_rows(session, "empty")

        assert rows == []

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup: int,
        static_datetime: datetime,
    ):
        """A re-run leaves a single row per upload."""
        async with AsyncSession(ctx.pg) as session:
            await insert_sample(session, "repeat", setup, static_datetime)
            upload_id = await insert_upload(
                session,
                "reads_1.fq.gz",
                setup,
                static_datetime,
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document("repeat", [upload_id]),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = await get_rows(session, "repeat")

        assert [row.upload_id for row in rows] == [upload_id]

    @pytest.mark.usefixtures("setup")
    async def test_empty_collection(self, ctx: MigrationContext):
        """An empty samples collection is a no-op."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM sample_uploads"))
            ).scalar_one()

        assert count == 0
