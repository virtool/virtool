"""Tests for the Mongo-to-Postgres index backfill."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.indexes.migration import copy_indexes_to_postgres
from virtool.indexes.sql import SQLIndex
from virtool.jobs.pg import SQLJob
from virtool.migration.ctx import MigrationContext
from virtool.tasks.sql import SQLTask
from virtool.users.pg import SQLUser
from virtool.utils import timestamp

_CREATED_AT = datetime(2026, 7, 1, 12, 0, 0)
"""The ``created_at`` carried by index documents; millisecond precision as Mongo holds."""

_MANIFEST = {"otu_a": 0, "otu_b": 3}
"""A representative OTU manifest."""


async def _seed_user(ctx: MigrationContext, handle: str, legacy_id: str) -> int:
    """Insert a ``users`` row; return its integer id."""
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle=handle,
            legacy_id=legacy_id,
            last_password_change=timestamp(),
            password=b"hashed",
            settings={},
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        await session.commit()

    return user_id


async def _seed_reference(
    ctx: MigrationContext,
    user_id: int,
    legacy_id: str,
) -> int:
    """Insert a ``legacy_references`` row; return its integer id."""
    async with AsyncSession(ctx.pg) as session:
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


async def _seed_job(ctx: MigrationContext, legacy_id: str, user_id: int) -> int:
    """Insert a ``jobs`` row; return its integer id."""
    async with AsyncSession(ctx.pg) as session:
        job = SQLJob(
            legacy_id=legacy_id,
            created_at=timestamp(),
            state="succeeded",
            user_id=user_id,
            workflow="build_index",
        )
        session.add(job)
        await session.flush()
        job_id = job.id
        await session.commit()

    return job_id


async def _seed_task(ctx: MigrationContext) -> int:
    """Insert a ``tasks`` row; return its integer id."""
    async with AsyncSession(ctx.pg) as session:
        task = SQLTask(created_at=timestamp(), type="create_index")
        session.add(task)
        await session.flush()
        task_id = task.id
        await session.commit()

    return task_id


def _index_doc(
    index_id: str,
    reference: int | str,
    user: int | str,
    *,
    job: int | str | None = None,
    task: int | None = None,
    version: int = 0,
    ready: bool = True,
) -> dict:
    """Build an index document in the shape the dual-write path writes."""
    return {
        "_id": index_id,
        "version": version,
        "created_at": _CREATED_AT,
        "manifest": _MANIFEST,
        "ready": ready,
        "job": {"id": job} if job is not None else None,
        "task": {"id": task} if task is not None else None,
        "user": {"id": user},
        "reference": {"id": reference},
    }


async def _fetch_index(ctx: MigrationContext, legacy_id: str) -> SQLIndex | None:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                select(SQLIndex).where(SQLIndex.legacy_id == legacy_id),
            )
        ).scalar_one_or_none()


async def _count(ctx: MigrationContext) -> int:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(text("SELECT count(*) FROM indexes"))
        ).scalar_one()


@pytest.fixture
async def seeded(ctx: MigrationContext, apply_alembic: Callable) -> dict[str, int]:
    """Apply the full schema and seed a user, reference, job and task.

    Returns the integer primary keys the index documents reference.
    """
    await asyncio.to_thread(apply_alembic, "head")

    user_id = await _seed_user(ctx, "index_owner", "index_owner_legacy")
    reference_id = await _seed_reference(ctx, user_id, "ref_legacy")
    job_id = await _seed_job(ctx, "job_legacy", user_id)
    task_id = await _seed_task(ctx)

    return {
        "user_id": user_id,
        "reference_id": reference_id,
        "job_id": job_id,
        "task_id": task_id,
    }


class TestCopyIndexes:
    async def test_backfills_a_job_backed_index(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_job",
                seeded["reference_id"],
                seeded["user_id"],
                job=seeded["job_id"],
                version=2,
            ),
        )

        await copy_indexes_to_postgres(ctx)

        row = await _fetch_index(ctx, "index_job")
        assert row.legacy_id == "index_job"
        assert row.storage_key == "index_job"
        assert row.version == 2
        assert row.created_at == _CREATED_AT
        assert row.manifest == _MANIFEST
        assert row.ready is True
        assert row.reference_id == seeded["reference_id"]
        assert row.user_id == seeded["user_id"]
        assert row.job_id == seeded["job_id"]
        assert row.task_id is None

    async def test_backfills_a_task_backed_index(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_task",
                seeded["reference_id"],
                seeded["user_id"],
                task=seeded["task_id"],
            ),
        )

        await copy_indexes_to_postgres(ctx)

        row = await _fetch_index(ctx, "index_task")
        assert row.task_id == seeded["task_id"]
        assert row.job_id is None

    async def test_resolves_embedded_legacy_string_ids(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """A pre-migration document embeds legacy string reference, user and job ids."""
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_legacy",
                "ref_legacy",
                "index_owner_legacy",
                job="job_legacy",
            ),
        )

        await copy_indexes_to_postgres(ctx)

        row = await _fetch_index(ctx, "index_legacy")
        assert row.reference_id == seeded["reference_id"]
        assert row.user_id == seeded["user_id"]
        assert row.job_id == seeded["job_id"]

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_job",
                seeded["reference_id"],
                seeded["user_id"],
                job=seeded["job_id"],
            ),
        )

        await copy_indexes_to_postgres(ctx)
        await copy_indexes_to_postgres(ctx)

        assert await _count(ctx) == 1

    async def test_converges_documents_added_after_first_run(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_existing",
                seeded["reference_id"],
                seeded["user_id"],
                job=seeded["job_id"],
                version=0,
            ),
        )

        await copy_indexes_to_postgres(ctx)

        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_gap",
                seeded["reference_id"],
                seeded["user_id"],
                task=seeded["task_id"],
                version=1,
            ),
        )

        await copy_indexes_to_postgres(ctx)

        assert await _fetch_index(ctx, "index_gap") is not None
        assert await _count(ctx) == 2

    async def test_leaves_an_already_migrated_row_untouched(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """A row the dual-write path already wrote is skipped, not overwritten."""
        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLIndex(
                    legacy_id="index_dual_written",
                    version=0,
                    created_at=_CREATED_AT,
                    manifest=_MANIFEST,
                    ready=True,
                    storage_key="index_dual_written",
                    reference_id=seeded["reference_id"],
                    user_id=seeded["user_id"],
                    task_id=seeded["task_id"],
                ),
            )
            await session.commit()

        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_dual_written",
                seeded["reference_id"],
                seeded["user_id"],
                task=seeded["task_id"],
            ),
        )

        await copy_indexes_to_postgres(ctx)

        assert await _count(ctx) == 1

    async def test_unresolvable_reference_raises(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_bad_reference",
                999999,
                seeded["user_id"],
                job=seeded["job_id"],
            ),
        )

        with pytest.raises(ValueError, match="references reference"):
            await copy_indexes_to_postgres(ctx)

    async def test_unresolvable_user_raises(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_bad_user",
                seeded["reference_id"],
                999999,
                job=seeded["job_id"],
            ),
        )

        with pytest.raises(ValueError, match="references user"):
            await copy_indexes_to_postgres(ctx)

    async def test_unresolvable_job_raises(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        await ctx.mongo.indexes.insert_one(
            _index_doc(
                "index_bad_job",
                seeded["reference_id"],
                seeded["user_id"],
                job=999999,
            ),
        )

        with pytest.raises(ValueError, match="references job"):
            await copy_indexes_to_postgres(ctx)
