"""Tests for the copy samples to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_4wxjh2cjere5_copy_samples_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.migration.ctx import MigrationContext
from virtool.utils import timestamp


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Apply alembic to the required revision and seed a user with a legacy id."""
    await asyncio.to_thread(apply_alembic, required_alembic_revision)

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, legacy_id, active, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES (
                    'testuser', 'legacy_user_123', true, '', false,
                    false, :now, :password, '{}'::jsonb
                )
                RETURNING id
            """),
            {"now": timestamp(), "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


async def insert_group(session: AsyncSession, name: str) -> int:
    """Insert a group and return its integer primary key."""
    result = await session.execute(
        text(
            "INSERT INTO groups (name, permissions) VALUES (:name, '{}') RETURNING id",
        ),
        {"name": name},
    )
    group_id = result.scalar_one()
    await session.commit()
    return group_id


async def insert_label(session: AsyncSession, name: str) -> int:
    """Insert a label and return its integer primary key."""
    result = await session.execute(
        text("INSERT INTO labels (name) VALUES (:name) RETURNING id"),
        {"name": name},
    )
    label_id = result.scalar_one()
    await session.commit()
    return label_id


async def insert_subtraction(
    session: AsyncSession,
    name: str,
    created_at: datetime,
) -> int:
    """Insert a subtraction and return its integer primary key."""
    result = await session.execute(
        text(
            "INSERT INTO subtractions (name, nickname, created_at, deleted, ready) "
            "VALUES (:name, '', :now, false, true) RETURNING id",
        ),
        {"name": name, "now": created_at},
    )
    subtraction_id = result.scalar_one()
    await session.commit()
    return subtraction_id


async def insert_job(session: AsyncSession, user_id: int, created_at: datetime) -> int:
    """Insert a job and return its integer primary key."""
    result = await session.execute(
        text("""
            INSERT INTO jobs (legacy_id, workflow, state, user_id, created_at)
            VALUES ('legacy_job', 'create_sample', 'succeeded', :user_id, :now)
            RETURNING id
        """),
        {"user_id": user_id, "now": created_at},
    )
    job_id = result.scalar_one()
    await session.commit()
    return job_id


def make_sample_document(
    sample_id: str,
    user_id: int | str,
    created_at: datetime,
    *,
    name: str = "Sample 1",
    group: int | None = None,
    job_id: int | None = None,
    labels: list[int] | None = None,
    subtractions: list[int] | None = None,
) -> dict:
    """Create a MongoDB sample document in the post-conversion shape."""
    return {
        "_id": sample_id,
        "all_read": True,
        "all_write": False,
        "created_at": created_at,
        "format": "fastq",
        "group": group,
        "group_read": True,
        "group_write": False,
        "hold": True,
        "host": "Vine",
        "is_legacy": False,
        "isolate": "Isolate A",
        "job": {"id": job_id} if job_id is not None else None,
        "labels": labels if labels is not None else [],
        "library_type": "normal",
        "locale": "Canada",
        "name": name,
        "notes": "A note",
        "paired": True,
        "quality": {"length": [50, 100]},
        "ready": True,
        "subtractions": subtractions if subtractions is not None else [],
        "user": {"id": user_id},
    }


async def get_sample_pk(session: AsyncSession, legacy_id: str) -> int:
    """Return the integer primary key of a backfilled sample by legacy id."""
    return (
        await session.execute(
            text("SELECT id FROM legacy_samples WHERE legacy_id = :legacy_id"),
            {"legacy_id": legacy_id},
        )
    ).scalar_one()


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_field_fidelity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document's scalar and json fields map correctly."""
        async with AsyncSession(ctx.pg) as session:
            group_id = await insert_group(session, "Technicians")
            job_id = await insert_job(session, setup_user, static_datetime)

        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "sample_1",
                setup_user,
                static_datetime,
                group=group_id,
                job_id=job_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT id, legacy_id, name, host, isolate, locale, notes,
                               library_type, format, group_id, quality, created_at,
                               paired, ready, hold, is_legacy, all_read, all_write,
                               group_read, group_write, user_id, job_id
                        FROM legacy_samples WHERE legacy_id = 'sample_1'
                    """),
                )
            ).one()

        assert isinstance(row.id, int)
        assert row.legacy_id == "sample_1"
        assert row.name == "Sample 1"
        assert row.host == "Vine"
        assert row.isolate == "Isolate A"
        assert row.locale == "Canada"
        assert row.notes == "A note"
        assert row.library_type == "normal"
        assert row.format == "fastq"
        assert row.group_id == group_id
        assert row.quality == {"length": [50, 100]}
        assert row.created_at == static_datetime
        assert row.paired is True
        assert row.ready is True
        assert row.hold is True
        assert row.is_legacy is False
        assert row.all_read is True
        assert row.all_write is False
        assert row.group_read is True
        assert row.group_write is False
        assert row.user_id == setup_user
        assert row.job_id == job_id

    async def test_user_legacy_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A legacy string user id resolves to the user's integer primary key."""
        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "legacy_user_sample",
                "legacy_user_123",
                static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT user_id FROM legacy_samples "
                        "WHERE legacy_id = 'legacy_user_sample'",
                    ),
                )
            ).scalar_one()

        assert stored == setup_user

    async def test_missing_user_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A sample referencing a user missing from postgres aborts the migration."""
        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "orphan_user_sample",
                setup_user + 9999,
                static_datetime,
            ),
        )

        with pytest.raises(ValueError, match="does not exist in postgres"):
            await upgrade(ctx)

    async def test_null_group_is_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """group_id is null when the document has no owner group."""
        await ctx.mongo.samples.insert_one(
            make_sample_document("no_group_sample", setup_user, static_datetime),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            group_id = (
                await session.execute(
                    text(
                        "SELECT group_id FROM legacy_samples "
                        "WHERE legacy_id = 'no_group_sample'",
                    ),
                )
            ).scalar_one()

        assert group_id is None

    async def test_orphan_job_is_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A sample referencing a deleted job is written with a null job_id."""
        await ctx.mongo.samples.insert_one(
            {
                **make_sample_document(
                    "orphan_job_sample",
                    setup_user,
                    static_datetime,
                ),
                "job": {"id": 999999},
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            job_id = (
                await session.execute(
                    text(
                        "SELECT job_id FROM legacy_samples "
                        "WHERE legacy_id = 'orphan_job_sample'",
                    ),
                )
            ).scalar_one()

        assert job_id is None

    async def test_label_join_rows(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Each label id becomes a legacy_sample_labels row."""
        async with AsyncSession(ctx.pg) as session:
            label_one = await insert_label(session, "Blue")
            label_two = await insert_label(session, "Red")

        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "labelled_sample",
                setup_user,
                static_datetime,
                labels=[label_one, label_two],
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            sample_pk = await get_sample_pk(session, "labelled_sample")
            linked = (
                (
                    await session.execute(
                        text(
                            "SELECT label_id FROM legacy_sample_labels "
                            "WHERE sample_id = :sample_id ORDER BY label_id",
                        ),
                        {"sample_id": sample_pk},
                    )
                )
                .scalars()
                .all()
            )

        assert linked == sorted([label_one, label_two])

    async def test_subtraction_join_rows(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Each subtraction id becomes a legacy_sample_subtractions row."""
        async with AsyncSession(ctx.pg) as session:
            subtraction_one = await insert_subtraction(
                session,
                "Arabidopsis",
                static_datetime,
            )
            subtraction_two = await insert_subtraction(
                session,
                "Vine",
                static_datetime,
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "subtracted_sample",
                setup_user,
                static_datetime,
                subtractions=[subtraction_one, subtraction_two],
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            sample_pk = await get_sample_pk(session, "subtracted_sample")
            linked = (
                (
                    await session.execute(
                        text(
                            "SELECT subtraction_id FROM legacy_sample_subtractions "
                            "WHERE sample_id = :sample_id ORDER BY subtraction_id",
                        ),
                        {"sample_id": sample_pk},
                    )
                )
                .scalars()
                .all()
            )

        assert linked == sorted([subtraction_one, subtraction_two])

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A re-run leaves a single sample row and a single set of join rows."""
        async with AsyncSession(ctx.pg) as session:
            label_id = await insert_label(session, "Blue")
            subtraction_id = await insert_subtraction(
                session,
                "Arabidopsis",
                static_datetime,
            )

        await ctx.mongo.samples.insert_one(
            make_sample_document(
                "repeat_sample",
                setup_user,
                static_datetime,
                labels=[label_id],
                subtractions=[subtraction_id],
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            sample_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_samples "
                        "WHERE legacy_id = 'repeat_sample'",
                    ),
                )
            ).scalar_one()
            sample_pk = await get_sample_pk(session, "repeat_sample")
            label_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_sample_labels "
                        "WHERE sample_id = :sample_id",
                    ),
                    {"sample_id": sample_pk},
                )
            ).scalar_one()
            subtraction_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_sample_subtractions "
                        "WHERE sample_id = :sample_id",
                    ),
                    {"sample_id": sample_pk},
                )
            ).scalar_one()

        assert sample_count == 1
        assert label_count == 1
        assert subtraction_count == 1

    async def test_row_count_parity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """The Postgres row count matches the Mongo document count."""
        for i in range(4):
            await ctx.mongo.samples.insert_one(
                make_sample_document(f"sample_{i}", setup_user, static_datetime),
            )

        await upgrade(ctx)

        mongo_count = await ctx.mongo.samples.count_documents({})

        async with AsyncSession(ctx.pg) as session:
            pg_count = (
                await session.execute(text("SELECT COUNT(*) FROM legacy_samples"))
            ).scalar_one()

        assert pg_count == mongo_count == 4

    @pytest.mark.usefixtures("setup_user")
    async def test_empty_collection(self, ctx: MigrationContext):
        """An empty samples collection is a no-op."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM legacy_samples"))
            ).scalar_one()

        assert count == 0
