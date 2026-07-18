"""Tests for the ``backfill analyses index ids to integers`` migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_bn8b4pzfvokk_backfill_analyses_index_ids_to_integers import (
    upgrade,
)
from virtool.indexes.sql import SQLIndex
from virtool.migration.ctx import MigrationContext
from virtool.users.pg import SQLUser
from virtool.utils import timestamp


async def _seed_user(session: AsyncSession) -> int:
    user = SQLUser(
        handle="analyst",
        legacy_id="analyst",
        last_password_change=timestamp(),
        password=b"hashed",
        settings={},
    )
    session.add(user)
    await session.flush()
    return user.id


async def _seed_index(session: AsyncSession, user_id: int, legacy_id: str) -> int:
    """Seed an ``indexes`` row (with its ``legacy_references`` parent) and return its
    integer id.
    """
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
            {"legacy_id": f"ref_{legacy_id}", "now": timestamp(), "user_id": user_id},
        )
    ).scalar_one()

    index = SQLIndex(
        legacy_id=legacy_id,
        version=0,
        created_at=timestamp(),
        manifest={},
        ready=True,
        storage_key=legacy_id,
        reference_id=reference_id,
        user_id=user_id,
    )
    session.add(index)
    await session.flush()

    return index.id


async def _insert_analysis(ctx: MigrationContext, index: str) -> int:
    """Insert an ``analyses`` row keyed by the legacy ``index`` string, ``index_id``
    left NULL.
    """
    async with AsyncSession(ctx.pg) as session:
        analysis_id = (
            await session.execute(
                text("""
                    INSERT INTO analyses (
                        created_at, updated_at, workflow, ready,
                        sample, reference, "index", user_id
                    )
                    VALUES (
                        :now, :now, 'nuvs', true,
                        'sample_legacy', 'ref_legacy', :index, :user_id
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "index": index, "user_id": await _user_id(ctx)},
            )
        ).scalar_one()
        await session.commit()

    return analysis_id


async def _user_id(ctx: MigrationContext) -> int:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("SELECT id FROM users WHERE handle = 'analyst'"),
            )
        ).scalar_one()


async def _fetch_index_id(ctx: MigrationContext, analysis_id: int) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("SELECT index_id FROM analyses WHERE id = :id"),
                {"id": analysis_id},
            )
        ).scalar_one()


@pytest.fixture
async def _at_head(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic, "head")


class TestBackfill:
    async def test_index_id_resolved_from_legacy_string(
        self,
        ctx: MigrationContext,
        _at_head: None,
    ):
        """The backfill fills ``index_id`` from ``indexes.legacy_id``."""
        async with AsyncSession(ctx.pg) as session:
            user_id = await _seed_user(session)
            index_pk = await _seed_index(session, user_id, "current_index")
            await session.commit()

        analysis_id = await _insert_analysis(ctx, "current_index")

        await upgrade(ctx)

        assert await _fetch_index_id(ctx, analysis_id) == index_pk

    async def test_idempotent(
        self,
        ctx: MigrationContext,
        _at_head: None,
    ):
        """A second run matches no rows and leaves ``index_id`` unchanged."""
        async with AsyncSession(ctx.pg) as session:
            user_id = await _seed_user(session)
            index_pk = await _seed_index(session, user_id, "current_index")
            await session.commit()

        analysis_id = await _insert_analysis(ctx, "current_index")

        await upgrade(ctx)
        await upgrade(ctx)

        assert await _fetch_index_id(ctx, analysis_id) == index_pk

    async def test_tripwire_raises_on_unresolved_index(
        self,
        ctx: MigrationContext,
        _at_head: None,
    ):
        """An ``index`` string that matches no ``indexes`` row raises loudly, naming
        the unresolved value, rather than leaving ``index_id`` NULL.
        """
        async with AsyncSession(ctx.pg) as session:
            await _seed_user(session)
            await session.commit()

        await _insert_analysis(ctx, "ghost_index")

        with pytest.raises(ValueError, match="ghost_index"):
            await upgrade(ctx)
