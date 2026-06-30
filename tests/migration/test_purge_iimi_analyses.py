"""Tests for the purge-iimi-analyses migration."""

import asyncio
from collections.abc import AsyncIterator, Callable

import arrow
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_icp41e0o5dwn_purge_iimi_analyses import upgrade
from virtool.analyses.sql import SQLAnalysis
from virtool.migration.ctx import MigrationContext
from virtool.storage.protocol import StorageBackend


async def _one_chunk(content: bytes) -> AsyncIterator[bytes]:
    yield content


def _analysis_document(analysis_id: str, sample_id: str, workflow: str) -> dict:
    return {
        "_id": analysis_id,
        "created_at": arrow.utcnow().naive,
        "updated_at": arrow.utcnow().naive,
        "index": {"id": "index_1"},
        "reference": {"id": "reference_1"},
        "ready": True,
        "results": None,
        "sample": {"id": sample_id},
        "subtractions": [],
        "user": {"id": "user_1"},
        "workflow": workflow,
    }


class TestUpgrade:
    async def _setup_user(self, ctx: MigrationContext, apply_alembic: Callable) -> int:
        await asyncio.to_thread(apply_alembic, "head")

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'testuser', 'legacy_user_1', true, '', false,
                        false, :now, :password, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": arrow.utcnow().naive, "password": b"hashed_password"},
            )
            user_id = result.scalar_one()
            await session.commit()

        return user_id

    async def _add_pg_analysis(
        self,
        ctx: MigrationContext,
        user_id: int,
        *,
        legacy_id: str,
        sample: str,
        workflow: str,
    ) -> None:
        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLAnalysis(
                    legacy_id=legacy_id,
                    created_at=arrow.utcnow().naive,
                    updated_at=arrow.utcnow().naive,
                    workflow=workflow,
                    ready=True,
                    sample=sample,
                    reference="reference_1",
                    index="index_1",
                    user_id=user_id,
                ),
            )
            await session.commit()

    async def test_purges_iimi_from_both_stores_and_storage(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
        memory_storage: StorageBackend,
    ):
        user_id = await self._setup_user(ctx, apply_alembic)

        await self._add_pg_analysis(
            ctx,
            user_id,
            legacy_id="iimi_pg",
            sample="sample_pg",
            workflow="iimi",
        )
        await self._add_pg_analysis(
            ctx,
            user_id,
            legacy_id="keep_pg",
            sample="sample_pg",
            workflow="pathoscope",
        )

        await ctx.mongo.analyses.insert_one(
            _analysis_document("iimi_mongo", "sample_mongo", "iimi"),
        )
        await ctx.mongo.analyses.insert_one(
            _analysis_document("keep_mongo", "sample_mongo", "pathoscope"),
        )

        purged_keys = (
            "samples/sample_pg/analysis/iimi_pg/results.json",
            "samples/sample_mongo/analysis/iimi_mongo/results.json",
        )
        retained_keys = (
            "samples/sample_pg/analysis/keep_pg/results.json",
            "samples/sample_mongo/analysis/keep_mongo/results.json",
        )

        for key in (*purged_keys, *retained_keys):
            await memory_storage.write(key, _one_chunk(b"content"))

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            remaining_pg = (
                (await session.execute(select(SQLAnalysis.legacy_id))).scalars().all()
            )

        assert set(remaining_pg) == {"keep_pg"}

        remaining_mongo = await ctx.mongo.analyses.distinct("_id")
        assert set(remaining_mongo) == {"keep_mongo"}

        for key in purged_keys:
            assert not await _exists(memory_storage, key)

        for key in retained_keys:
            assert await _exists(memory_storage, key)

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
        memory_storage: StorageBackend,
    ):
        user_id = await self._setup_user(ctx, apply_alembic)

        await self._add_pg_analysis(
            ctx,
            user_id,
            legacy_id="iimi_pg",
            sample="sample_pg",
            workflow="iimi",
        )
        await self._add_pg_analysis(
            ctx,
            user_id,
            legacy_id="keep_pg",
            sample="sample_pg",
            workflow="pathoscope",
        )
        await ctx.mongo.analyses.insert_one(
            _analysis_document("keep_mongo", "sample_mongo", "pathoscope"),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            remaining_pg = (
                (await session.execute(select(SQLAnalysis.legacy_id))).scalars().all()
            )

        assert set(remaining_pg) == {"keep_pg"}
        assert set(await ctx.mongo.analyses.distinct("_id")) == {"keep_mongo"}


async def _exists(storage: StorageBackend, key: str) -> bool:
    async for _ in storage.list(key):
        return True
    return False
