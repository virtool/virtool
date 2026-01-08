"""Tests for the copy jobs to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_xtwxolun286s_copy_jobs_to_postgres import upgrade
from virtool.migration.ctx import MigrationContext


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Create a user in PostgreSQL using raw SQL and return their ID."""
    await asyncio.to_thread(apply_alembic)

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, legacy_id, active, b2c_oid, b2c_display_name,
                    b2c_given_name, b2c_family_name, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES (
                    'testuser', 'legacy_user_123', true, NULL, '',
                    '', '', '', false,
                    false, :now, :password, '{}'::jsonb
                )
                RETURNING id
            """),
            {"now": arrow.utcnow().naive, "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


def make_job_document(
    job_id: str,
    user_id: str,
    workflow: str,
    state: str,
    created_at: datetime,
    args: dict | None = None,
    ping: dict | None = None,
    *,
    acquired: bool = False,
) -> dict:
    """Create a MongoDB job document for testing."""
    return {
        "_id": job_id,
        "acquired": acquired,
        "args": args or {},
        "created_at": created_at,
        "key": None,
        "ping": ping,
        "status": [
            {
                "error": None,
                "timestamp": created_at,
                "state": "waiting",
                "stage": None,
                "progress": 0,
            },
            {
                "error": None,
                "timestamp": created_at,
                "state": state,
                "stage": None,
                "progress": 100 if state == "complete" else 50,
            },
        ],
        "user": {"id": user_id},
        "workflow": workflow,
    }


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_basic_migration(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Test that a basic job is migrated correctly."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="job_123",
                user_id="legacy_user_123",
                workflow="nuvs",
                state="complete",
                created_at=static_datetime,
                args={"analysis_id": "analysis_456"},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    SELECT legacy_id, workflow, state, user_id, created_at, finished_at
                    FROM jobs WHERE legacy_id = 'job_123'
                """),
            )
            row = result.one()

            assert row.legacy_id == "job_123"
            assert row.workflow == "nuvs"
            assert row.state == "succeeded"
            assert row.user_id == setup_user
            assert row.created_at == static_datetime
            assert row.finished_at == static_datetime

    @pytest.mark.usefixtures("setup_user")
    async def test_state_mapping(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that V1 states are correctly mapped to V2 states."""
        state_mappings = [
            ("waiting", "pending"),
            ("preparing", "running"),
            ("running", "running"),
            ("complete", "succeeded"),
            ("error", "failed"),
            ("terminated", "failed"),
            ("timeout", "failed"),
            ("cancelled", "cancelled"),
        ]

        for v1_state, _ in state_mappings:
            await ctx.mongo.jobs.insert_one(
                make_job_document(
                    job_id=f"job_{v1_state}",
                    user_id="legacy_user_123",
                    workflow="nuvs",
                    state=v1_state,
                    created_at=static_datetime,
                ),
            )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            for v1_state, expected_v2_state in state_mappings:
                result = await session.execute(
                    text("SELECT state FROM jobs WHERE legacy_id = :legacy_id"),
                    {"legacy_id": f"job_{v1_state}"},
                )
                row = result.one()
                assert row.state == expected_v2_state

    async def test_skip_existing_jobs(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Test that jobs already in PostgreSQL are skipped."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="existing_job",
                user_id="legacy_user_123",
                workflow="nuvs",
                state="complete",
                created_at=static_datetime,
            ),
        )

        # Pre-create job in PostgreSQL using raw SQL.
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                    INSERT INTO jobs (legacy_id, workflow, state, user_id, created_at)
                    VALUES ('existing_job', 'nuvs', 'succeeded', :user_id, :created_at)
                """),
                {"user_id": setup_user, "created_at": static_datetime},
            )
            await session.commit()

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM jobs WHERE legacy_id = 'existing_job'"),
            )
            assert result.scalar_one() == 1

    @pytest.mark.usefixtures("setup_user")
    async def test_relationship_sample(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that create_sample jobs create job_samples records."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="sample_job",
                user_id="legacy_user_123",
                workflow="create_sample",
                state="complete",
                created_at=static_datetime,
                args={"sample_id": "sample_789"},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    SELECT js.sample_id
                    FROM job_samples js
                    JOIN jobs j ON js.job_id = j.id
                    WHERE j.legacy_id = 'sample_job'
                """),
            )
            assert result.scalar_one() == "sample_789"

    @pytest.mark.usefixtures("setup_user")
    async def test_relationship_index(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that build_index jobs create job_indexes records."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="index_job",
                user_id="legacy_user_123",
                workflow="build_index",
                state="complete",
                created_at=static_datetime,
                args={"index_id": "index_789"},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    SELECT ji.index_id
                    FROM job_indexes ji
                    JOIN jobs j ON ji.job_id = j.id
                    WHERE j.legacy_id = 'index_job'
                """),
            )
            assert result.scalar_one() == "index_789"

    @pytest.mark.usefixtures("setup_user")
    async def test_relationship_subtraction(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that create_subtraction jobs create job_subtractions records."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="subtraction_job",
                user_id="legacy_user_123",
                workflow="create_subtraction",
                state="complete",
                created_at=static_datetime,
                args={"subtraction_id": "subtraction_789"},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    SELECT js.subtraction_id
                    FROM job_subtractions js
                    JOIN jobs j ON js.job_id = j.id
                    WHERE j.legacy_id = 'subtraction_job'
                """),
            )
            assert result.scalar_one() == "subtraction_789"

    @pytest.mark.usefixtures("setup_user")
    async def test_relationship_analysis(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that analysis workflows create job_analyses records."""
        for workflow in ["aodp", "nuvs", "pathoscope"]:
            await ctx.mongo.jobs.insert_one(
                make_job_document(
                    job_id=f"{workflow}_job",
                    user_id="legacy_user_123",
                    workflow=workflow,
                    state="complete",
                    created_at=static_datetime,
                    args={"analysis_id": f"{workflow}_analysis"},
                ),
            )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            for workflow in ["aodp", "nuvs", "pathoscope"]:
                result = await session.execute(
                    text("""
                        SELECT ja.analysis_id
                        FROM job_analyses ja
                        JOIN jobs j ON ja.job_id = j.id
                        WHERE j.legacy_id = :legacy_id
                    """),
                    {"legacy_id": f"{workflow}_job"},
                )
                assert result.scalar_one() == f"{workflow}_analysis"

    @pytest.mark.usefixtures("setup_user")
    async def test_missing_user_raises(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that a job with a missing user raises an error."""
        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="orphan_job",
                user_id="nonexistent_user",
                workflow="nuvs",
                state="complete",
                created_at=static_datetime,
            ),
        )

        with pytest.raises(ValueError, match="not found in postgres"):
            await upgrade(ctx)

    @pytest.mark.usefixtures("setup_user")
    async def test_missing_status_raises(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that a job with no status raises an error."""
        await ctx.mongo.jobs.insert_one(
            {
                "_id": "no_status_job",
                "acquired": False,
                "args": {},
                "created_at": static_datetime,
                "key": None,
                "ping": None,
                "status": [],
                "user": {"id": "legacy_user_123"},
                "workflow": "nuvs",
            },
        )

        with pytest.raises(ValueError, match="has no status"):
            await upgrade(ctx)

    @pytest.mark.usefixtures("setup_user")
    async def test_ping_timestamp(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Test that ping timestamp is migrated correctly."""
        ping_time = arrow.get(2024, 1, 15, 13, 0, 0).naive

        await ctx.mongo.jobs.insert_one(
            make_job_document(
                job_id="pinged_job",
                user_id="legacy_user_123",
                workflow="nuvs",
                state="running",
                created_at=static_datetime,
                acquired=True,
                ping={"pinged_at": ping_time},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    SELECT pinged_at, acquired FROM jobs WHERE legacy_id = 'pinged_job'
                """),
            )
            row = result.one()
            assert row.pinged_at == ping_time
            assert row.acquired is True
