"""Tests for the copy analyses to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import insert, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_1nl7v191h0ba_copy_analyses_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.analyses.sql import SQLAnalysisResult
from virtool.migration.ctx import MigrationContext


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Create a user in PostgreSQL using raw SQL and return their integer ID."""
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
            {"now": arrow.utcnow().naive, "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


def make_analysis_document(
    analysis_id: str,
    user_id: int,
    created_at: datetime,
    *,
    workflow: str = "pathoscope",
    ready: bool = True,
    results: dict | str | None = None,
    subtractions: list | None = None,
    job_id: int | None = None,
    ml: int | None = None,
) -> dict:
    """Create a MongoDB analysis document for testing."""
    return {
        "_id": analysis_id,
        "created_at": created_at,
        "updated_at": created_at,
        "files": [],
        "index": {"id": "index_1", "version": 3},
        "job": {"id": job_id} if job_id is not None else None,
        "ml": ml,
        "reference": {"id": "reference_1"},
        "ready": ready,
        "results": results,
        "sample": {"id": "sample_1"},
        "space": {"id": 1},
        "subtractions": subtractions if subtractions is not None else [],
        "user": {"id": user_id},
        "workflow": workflow,
    }


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_field_fidelity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document's scalar and string-id fields map correctly."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="analysis_1",
                user_id=setup_user,
                created_at=static_datetime,
                workflow="nuvs",
                ml=None,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT id, legacy_id, created_at, updated_at, workflow, ready,
                               sample, reference, index, user_id, job_id, ml_id
                        FROM analyses WHERE legacy_id = 'analysis_1'
                    """),
                )
            ).one()

        assert isinstance(row.id, int)
        assert row.legacy_id == "analysis_1"
        assert row.created_at == static_datetime
        assert row.updated_at == static_datetime
        assert row.workflow == "nuvs"
        assert row.ready is True
        assert row.sample == "sample_1"
        assert row.reference == "reference_1"
        assert row.index == "index_1"
        assert row.user_id == setup_user
        assert row.ml_id is None

    async def test_inline_dict_results(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document with inline dict results stores them verbatim."""
        results = {"hits": [{"id": "otu_1", "pi": 0.5}]}

        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="inline_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                results=results,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT results FROM analyses WHERE legacy_id = 'inline_analysis'"
                    ),
                )
            ).scalar_one()

        assert stored == results

    async def test_sql_marker_results(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A "sql"-marker document pulls results from the analysis_results table."""
        results = {"hits": [{"id": "otu_2", "pi": 0.9}]}

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                insert(SQLAnalysisResult).values(
                    analysis_id="sql_analysis",
                    results=results,
                ),
            )
            await session.commit()

        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="sql_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                results="sql",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT results FROM analyses WHERE legacy_id = 'sql_analysis'"
                    ),
                )
            ).scalar_one()

        assert stored == results

    async def test_no_results(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document with no results stores NULL."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="pending_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                ready=False,
                results=None,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT results FROM analyses WHERE legacy_id = 'pending_analysis'"
                    ),
                )
            ).scalar_one()

        assert stored is None

    async def test_none_subtractions_become_empty_list(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document with None subtractions stores an empty list."""
        document = make_analysis_document(
            analysis_id="iimi_analysis",
            user_id=setup_user,
            created_at=static_datetime,
        )
        document["subtractions"] = None

        await ctx.mongo.analyses.insert_one(document)

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT subtractions FROM analyses WHERE legacy_id = 'iimi_analysis'"
                    ),
                )
            ).scalar_one()

        assert stored == []

    async def test_null_job_and_ml(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """job_id and ml_id are null when the document has no job or ml."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="no_job_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                job_id=None,
                ml=None,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT job_id, ml_id FROM analyses WHERE legacy_id = 'no_job_analysis'"
                    ),
                )
            ).one()

        assert row.job_id is None
        assert row.ml_id is None

    async def test_job_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """An integer job id is written to the job_id foreign key."""
        async with AsyncSession(ctx.pg) as session:
            job_id = (
                await session.execute(
                    text("""
                        INSERT INTO jobs (legacy_id, workflow, state, user_id, created_at)
                        VALUES ('legacy_job', 'pathoscope', 'succeeded', :user_id, :now)
                        RETURNING id
                    """),
                    {"user_id": setup_user, "now": static_datetime},
                )
            ).scalar_one()
            await session.commit()

        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="job_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                job_id=job_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT job_id FROM analyses WHERE legacy_id = 'job_analysis'"
                    ),
                )
            ).scalar_one()

        assert stored == job_id

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Running the migration twice leaves a single row per document."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="repeat_analysis",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM analyses WHERE legacy_id = 'repeat_analysis'"
                    ),
                )
            ).scalar_one()

        assert count == 1

    async def test_row_count_parity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """The Postgres row count matches the number of Mongo documents."""
        for i in range(5):
            await ctx.mongo.analyses.insert_one(
                make_analysis_document(
                    analysis_id=f"analysis_{i}",
                    user_id=setup_user,
                    created_at=static_datetime,
                ),
            )

        await upgrade(ctx)

        mongo_count = await ctx.mongo.analyses.count_documents({})

        async with AsyncSession(ctx.pg) as session:
            pg_count = (
                await session.execute(text("SELECT COUNT(*) FROM analyses"))
            ).scalar_one()

        assert pg_count == mongo_count == 5

    async def test_file_marker_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A "file"-marker document aborts the migration loudly."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="file_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                results="file",
            ),
        )

        with pytest.raises(ValueError, match="file-backed results"):
            await upgrade(ctx)

    async def test_unexpected_results_value_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document with an unrecognized results marker aborts loudly."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="bad_marker_analysis",
                user_id=setup_user,
                created_at=static_datetime,
                results="unknown_marker",
            ),
        )

        with pytest.raises(ValueError, match="unexpected results value"):
            await upgrade(ctx)

    async def test_unknown_user_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document referencing an unknown user violates the foreign key."""
        await ctx.mongo.analyses.insert_one(
            make_analysis_document(
                analysis_id="orphan_analysis",
                user_id=setup_user + 9999,
                created_at=static_datetime,
            ),
        )

        with pytest.raises(IntegrityError):
            await upgrade(ctx)

    @pytest.mark.usefixtures("setup_user")
    async def test_empty_collection(self, ctx: MigrationContext):
        """An empty analyses collection is a no-op."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM analyses"))
            ).scalar_one()

        assert count == 0
