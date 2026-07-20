"""Tests for the ``legacy_history.index_id`` backfill."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.history.migration import backfill_history_index_ids
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndex
from virtool.migration.ctx import MigrationContext
from virtool.users.pg import SQLUser
from virtool.utils import timestamp

_CREATED_AT = datetime(2026, 7, 1, 12, 0, 0)


async def _seed_user(ctx: MigrationContext) -> int:
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle="history_owner",
            legacy_id="history_owner_legacy",
            last_password_change=timestamp(),
            password=b"hashed",
            settings={},
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        await session.commit()

    return user_id


async def _seed_reference(ctx: MigrationContext, user_id: int) -> int:
    async with AsyncSession(ctx.pg) as session:
        reference_id = (
            await session.execute(
                text("""
                    INSERT INTO legacy_references (
                        legacy_id, name, description, organism, created_at,
                        archived, restrict_source_types, source_types, user_id
                    )
                    VALUES (
                        'ref_legacy', 'Plant Viruses', '', '', :now,
                        false, false, '[]'::jsonb, :user_id
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "user_id": user_id},
            )
        ).scalar_one()
        await session.commit()

    return reference_id


async def _seed_index(
    ctx: MigrationContext,
    legacy_id: str,
    reference_id: int,
    user_id: int,
    version: int,
) -> int:
    async with AsyncSession(ctx.pg) as session:
        index = SQLIndex(
            legacy_id=legacy_id,
            version=version,
            created_at=_CREATED_AT,
            manifest={},
            ready=True,
            storage_key=legacy_id,
            reference_id=reference_id,
            user_id=user_id,
        )
        session.add(index)
        await session.flush()
        index_id = index.id
        await session.commit()

    return index_id


async def _seed_history(
    ctx: MigrationContext,
    legacy_id: str,
    reference_id: int,
    user_id: int,
    index: str | None,
    index_id: int | None = None,
    index_version: str | None = None,
) -> None:
    async with AsyncSession(ctx.pg) as session:
        session.add(
            SQLLegacyHistory(
                legacy_id=legacy_id,
                created_at=_CREATED_AT,
                description="",
                method_name="create",
                user_id=user_id,
                otu=legacy_id.split(".", maxsplit=1)[0],
                otu_name="Virus",
                otu_version="0",
                reference_id=reference_id,
                index=index,
                index_id=index_id,
                index_version=index_version,
            ),
        )
        await session.commit()


async def _fetch_index_id(ctx: MigrationContext, legacy_id: str) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        return await session.scalar(
            select(SQLLegacyHistory.index_id).where(
                SQLLegacyHistory.legacy_id == legacy_id,
            ),
        )


@pytest.fixture
async def seeded(ctx: MigrationContext, apply_alembic: Callable) -> dict[str, int]:
    """Apply the full schema and seed a user, reference and one built index."""
    await asyncio.to_thread(apply_alembic, "head")

    user_id = await _seed_user(ctx)
    reference_id = await _seed_reference(ctx, user_id)
    index_id = await _seed_index(ctx, "idx_legacy", reference_id, user_id, version=0)

    return {"user_id": user_id, "reference_id": reference_id, "index_id": index_id}


class TestBackfillHistoryIndexIds:
    async def test_resolves_index_string(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """A built change's ``index`` string is promoted to the integer foreign key."""
        await _seed_history(
            ctx,
            "otu_a.0",
            seeded["reference_id"],
            seeded["user_id"],
            index="idx_legacy",
            index_version="0",
        )

        await backfill_history_index_ids(ctx)

        assert await _fetch_index_id(ctx, "otu_a.0") == seeded["index_id"]

    async def test_leaves_unbuilt_null(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """An unbuilt change (``index`` is ``NULL``) keeps a ``NULL`` ``index_id`` and
        does not raise.
        """
        await _seed_history(
            ctx,
            "otu_a.0",
            seeded["reference_id"],
            seeded["user_id"],
            index=None,
        )

        await backfill_history_index_ids(ctx)

        assert await _fetch_index_id(ctx, "otu_a.0") is None

    async def test_raises_on_unresolvable_index_string(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """A non-null ``index`` string with no ``indexes`` row aborts the backfill."""
        await _seed_history(
            ctx,
            "otu_a.0",
            seeded["reference_id"],
            seeded["user_id"],
            index="missing",
            index_version="0",
        )

        with pytest.raises(ValueError, match="does not resolve to an indexes row"):
            await backfill_history_index_ids(ctx)

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        seeded: dict[str, int],
    ):
        """Re-running the backfill leaves an already-resolved ``index_id`` unchanged and
        never touches unbuilt rows.
        """
        await _seed_history(
            ctx,
            "otu_a.0",
            seeded["reference_id"],
            seeded["user_id"],
            index="idx_legacy",
            index_version="0",
        )
        await _seed_history(
            ctx,
            "otu_b.0",
            seeded["reference_id"],
            seeded["user_id"],
            index=None,
        )

        await backfill_history_index_ids(ctx)
        await backfill_history_index_ids(ctx)

        assert await _fetch_index_id(ctx, "otu_a.0") == seeded["index_id"]
        assert await _fetch_index_id(ctx, "otu_b.0") is None
