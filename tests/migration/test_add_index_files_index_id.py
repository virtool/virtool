"""Tests for the add/finalize ``index_files.index_id`` migrations."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.indexes.sql import SQLIndex
from virtool.jobs.pg import SQLJob
from virtool.migration.ctx import MigrationContext
from virtool.users.pg import SQLUser
from virtool.utils import timestamp

PREVIOUS_REVISION = "6ffca63a8b95"
ADD_REVISION = "89a96e2f4db3"
FINALIZE_REVISION = "f61c6dbf7ff6"


async def _seed_index(ctx: MigrationContext, legacy_id: str) -> int:
    """Seed a full ``indexes`` row (with its FK parents) and return its integer id."""
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle=f"user_{legacy_id}",
            legacy_id=f"user_{legacy_id}",
            last_password_change=timestamp(),
            password=b"hashed",
            settings={},
        )
        session.add(user)
        await session.flush()

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
                {
                    "legacy_id": f"ref_{legacy_id}",
                    "now": timestamp(),
                    "user_id": user.id,
                },
            )
        ).scalar_one()

        job = SQLJob(
            legacy_id=f"job_{legacy_id}",
            created_at=timestamp(),
            state="succeeded",
            user_id=user.id,
            workflow="build_index",
        )
        session.add(job)
        await session.flush()

        index = SQLIndex(
            legacy_id=legacy_id,
            version=0,
            created_at=timestamp(),
            manifest={},
            ready=True,
            storage_key=legacy_id,
            reference_id=reference_id,
            user_id=user.id,
            job_id=job.id,
            task_id=None,
        )
        session.add(index)
        await session.flush()

        index_pk = index.id
        await session.commit()

    return index_pk


async def _insert_index_file(ctx: MigrationContext, index: str, name: str) -> int:
    """Insert an ``index_files`` row keyed by the legacy ``index`` string."""
    async with AsyncSession(ctx.pg) as session:
        file_id = (
            await session.execute(
                text("""
                    INSERT INTO index_files ("index", name, type, size)
                    VALUES (:index, :name, 'json', 100)
                    RETURNING id
                """),
                {"index": index, "name": name},
            )
        ).scalar_one()
        await session.commit()

    return file_id


async def _fetch_index_id(ctx: MigrationContext, file_id: int) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("SELECT index_id FROM index_files WHERE id = :id"),
                {"id": file_id},
            )
        ).scalar_one()


@pytest.fixture
async def _at_previous_revision(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic, PREVIOUS_REVISION)


class TestBackfill:
    async def test_index_id_resolved_from_legacy_string(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """The add revision fills ``index_id`` from ``indexes.legacy_id``."""
        index_pk = await _seed_index(ctx, "index_1")
        file_id = await _insert_index_file(ctx, "index_1", "reference.json.gz")

        await asyncio.to_thread(apply_alembic, ADD_REVISION)

        assert await _fetch_index_id(ctx, file_id) == index_pk

    async def test_unresolved_row_stays_null_before_finalize(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """A file whose ``index`` matches no ``indexes`` row keeps ``index_id`` NULL
        after the add revision; the column is still nullable at this point.
        """
        file_id = await _insert_index_file(ctx, "orphan_index", "reference.json.gz")

        await asyncio.to_thread(apply_alembic, ADD_REVISION)

        assert await _fetch_index_id(ctx, file_id) is None


class TestFinalize:
    async def test_deletes_orphaned_rows(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """A row whose ``index`` matches no ``indexes`` row is stale (its index was
        deleted) and is dropped by finalize rather than tripping the NOT NULL check.
        """
        file_id = await _insert_index_file(ctx, "orphan_index", "reference.json.gz")

        await asyncio.to_thread(apply_alembic, FINALIZE_REVISION)

        async with AsyncSession(ctx.pg) as session:
            remaining = (
                await session.execute(
                    text("SELECT COUNT(*) FROM index_files WHERE id = :id"),
                    {"id": file_id},
                )
            ).scalar_one()

        assert remaining == 0

    async def test_trips_on_unbackfilled_live_index(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """A NULL ``index_id`` whose ``index`` still resolves to a live index is a
        backfill gap, not a stale orphan, so finalize refuses to set NOT NULL.
        """
        await _seed_index(ctx, "index_1")

        await asyncio.to_thread(apply_alembic, ADD_REVISION)

        # Insert after the backfill so ``index_id`` stays NULL even though the
        # parent index exists -- the backfill gap the tripwire guards against.
        await _insert_index_file(ctx, "index_1", "reference.json.gz")

        with pytest.raises(RuntimeError, match="NULL index_id"):
            await asyncio.to_thread(apply_alembic, FINALIZE_REVISION)

    async def test_enforces_not_null(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """After finalize, an ``index_files`` row cannot omit ``index_id``."""
        await _seed_index(ctx, "index_1")
        await _insert_index_file(ctx, "index_1", "reference.json.gz")

        await asyncio.to_thread(apply_alembic, FINALIZE_REVISION)

        with pytest.raises(IntegrityError):
            await _insert_index_file(ctx, "no_such_index", "reference.fa.gz")

    async def test_new_unique_constraint_rejects_duplicate(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """After finalize, ``(index_id, name)`` is unique."""
        index_pk = await _seed_index(ctx, "index_1")

        await asyncio.to_thread(apply_alembic, FINALIZE_REVISION)

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                    INSERT INTO index_files ("index", index_id, name, type, size)
                    VALUES ('index_1', :index_id, 'reference.json.gz', 'json', 100)
                """),
                {"index_id": index_pk},
            )
            await session.commit()

        with pytest.raises(IntegrityError):
            async with AsyncSession(ctx.pg) as session:
                await session.execute(
                    text("""
                        INSERT INTO index_files ("index", index_id, name, type, size)
                        VALUES ('index_1', :index_id, 'reference.json.gz', 'json', 200)
                    """),
                    {"index_id": index_pk},
                )
                await session.commit()
