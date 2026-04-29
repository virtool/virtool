"""Tests for the rename-pathoscope-bowtie-to-pathoscope migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_3g8rzbqj6k69_rename_pathoscope_bowtie_to_pathoscope import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def applied(ctx: MigrationContext, apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic, "head")


async def _insert_user(
    ctx: MigrationContext,
    handle: str,
    quick_analyze_workflow: str | None,
) -> int:
    settings = (
        '{"quick_analyze_workflow": "' + quick_analyze_workflow + '"}'
        if quick_analyze_workflow is not None
        else "{}"
    )
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text(
                f"""
                INSERT INTO users (
                    handle, active, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES (
                    :handle, true, '', false, false, :now, :pw, '{settings}'::jsonb
                )
                RETURNING id
                """,
            ),
            {"handle": handle, "now": arrow.utcnow().naive, "pw": b"hashed"},
        )
        user_id = result.scalar_one()
        await session.commit()
    return user_id


async def _insert_job(ctx: MigrationContext, user_id: int, workflow: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text(
                """
                INSERT INTO jobs (
                    acquired, created_at, state, user_id, workflow
                )
                VALUES (false, :now, 'pending', :user_id, :workflow)
                RETURNING id
                """,
            ),
            {
                "now": arrow.utcnow().naive,
                "user_id": user_id,
                "workflow": workflow,
            },
        )
        job_id = result.scalar_one()
        await session.commit()
    return job_id


async def _get_job_workflow(ctx: MigrationContext, job_id: int) -> str:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT workflow FROM jobs WHERE id = :id"),
            {"id": job_id},
        )
        return result.scalar_one()


async def _get_user_setting(ctx: MigrationContext, user_id: int) -> str | None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text(
                "SELECT settings->>'quick_analyze_workflow' FROM users WHERE id = :id",
            ),
            {"id": user_id},
        )
        return result.scalar_one()


@pytest.mark.usefixtures("applied")
class TestUpgrade:
    async def test_renames_jobs_workflow(self, ctx: MigrationContext):
        user_id = await _insert_user(ctx, "alice", None)
        legacy = await _insert_job(ctx, user_id, "pathoscope_bowtie")
        canonical = await _insert_job(ctx, user_id, "pathoscope")
        unrelated = await _insert_job(ctx, user_id, "nuvs")

        await upgrade(ctx)

        assert await _get_job_workflow(ctx, legacy) == "pathoscope"
        assert await _get_job_workflow(ctx, canonical) == "pathoscope"
        assert await _get_job_workflow(ctx, unrelated) == "nuvs"

    async def test_renames_user_quick_analyze_workflow(
        self,
        ctx: MigrationContext,
    ):
        legacy = await _insert_user(ctx, "alice", "pathoscope_bowtie")
        canonical = await _insert_user(ctx, "bob", "pathoscope")
        unrelated = await _insert_user(ctx, "carol", "nuvs")
        unset = await _insert_user(ctx, "dave", None)

        await upgrade(ctx)

        assert await _get_user_setting(ctx, legacy) == "pathoscope"
        assert await _get_user_setting(ctx, canonical) == "pathoscope"
        assert await _get_user_setting(ctx, unrelated) == "nuvs"
        assert await _get_user_setting(ctx, unset) is None

    async def test_renames_mongo_analyses_workflow(self, ctx: MigrationContext):
        await ctx.mongo.analyses.insert_many(
            [
                {"_id": "a1", "workflow": "pathoscope_bowtie"},
                {"_id": "a2", "workflow": "pathoscope"},
                {"_id": "a3", "workflow": "nuvs"},
            ],
        )

        await upgrade(ctx)

        docs = {
            doc["_id"]: doc["workflow"] async for doc in ctx.mongo.analyses.find({})
        }
        assert docs == {
            "a1": "pathoscope",
            "a2": "pathoscope",
            "a3": "nuvs",
        }

    async def test_idempotent(self, ctx: MigrationContext):
        user_id = await _insert_user(ctx, "alice", "pathoscope_bowtie")
        job_id = await _insert_job(ctx, user_id, "pathoscope_bowtie")
        await ctx.mongo.analyses.insert_one(
            {"_id": "a1", "workflow": "pathoscope_bowtie"},
        )

        await upgrade(ctx)
        await upgrade(ctx)

        assert await _get_job_workflow(ctx, job_id) == "pathoscope"
        assert await _get_user_setting(ctx, user_id) == "pathoscope"
        doc = await ctx.mongo.analyses.find_one({"_id": "a1"})
        assert doc["workflow"] == "pathoscope"
