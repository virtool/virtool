"""Tests for the analysis_subtractions normalization migrations.

Covers the backfill that resolves the ``analyses.subtractions`` JSONB array to
integer ``subtractions.id`` rows, the tripwire that guards the column drop, and
the column drop itself.
"""

import asyncio
import importlib.util
import json
from collections.abc import Callable
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext
from virtool.utils import timestamp

CREATE_REVISION = "0536aee705e9"
BACKFILL_REVISION = "eb5cf4abd58a"
DROP_REVISION = "869aa923399e"

_backfill_path = (
    Path(__file__).parents[2]
    / "assets/alembic/versions"
    / f"{BACKFILL_REVISION}_backfill_analysis_subtractions_from_.py"
)
_spec = importlib.util.spec_from_file_location("_backfill_analysis", _backfill_path)
_backfill_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_backfill_module)
BACKFILL_SQL = _backfill_module.BACKFILL_SQL


async def _insert_user(session: AsyncSession) -> int:
    return (
        await session.execute(
            text("""
                INSERT INTO users (
                    handle, legacy_id, active, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES (
                    'analyst', 'analyst_legacy', true, '',
                    false, false, :now, :pw, '{}'::jsonb
                )
                RETURNING id
            """),
            {"now": timestamp(), "pw": b"hashed"},
        )
    ).scalar_one()


async def _insert_subtraction(
    session: AsyncSession, name: str, legacy_id: str | None
) -> int:
    return (
        await session.execute(
            text("""
                INSERT INTO subtractions (
                    legacy_id, name, nickname, created_at, deleted, ready
                )
                VALUES (:legacy_id, :name, '', :now, false, true)
                RETURNING id
            """),
            {"legacy_id": legacy_id, "name": name, "now": timestamp()},
        )
    ).scalar_one()


async def _insert_analysis(
    session: AsyncSession, user_id: int, subtractions: list
) -> int:
    return (
        await session.execute(
            text("""
                INSERT INTO analyses (
                    legacy_id, created_at, updated_at, workflow, ready,
                    sample, reference, index, subtractions, user_id
                )
                VALUES (
                    NULL, :now, :now, 'nuvs', false,
                    'sample', 'reference', 'index', CAST(:subs AS jsonb), :user_id
                )
                RETURNING id
            """),
            {
                "now": timestamp(),
                "subs": json.dumps(subtractions),
                "user_id": user_id,
            },
        )
    ).scalar_one()


async def _linked_subtraction_ids(ctx: MigrationContext, analysis_id: int) -> list[int]:
    async with AsyncSession(ctx.pg) as session:
        return sorted(
            (
                await session.execute(
                    text(
                        "SELECT subtraction_id FROM analysis_subtractions "
                        "WHERE analysis_id = :id",
                    ),
                    {"id": analysis_id},
                )
            )
            .scalars()
            .all(),
        )


@pytest.fixture
async def seeded(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict:
    """Apply alembic up to the create-table revision and seed the source data.

    Leaves the JSONB ``analyses.subtractions`` column populated but the
    association table empty, the exact state the backfill expects.
    """
    await asyncio.to_thread(apply_alembic, CREATE_REVISION)

    async with AsyncSession(ctx.pg) as session:
        user_id = await _insert_user(session)

        vitis = await _insert_subtraction(session, "Vitis", "vitis_legacy")
        malus = await _insert_subtraction(session, "Malus", "malus_legacy")
        native = await _insert_subtraction(session, "Native", None)

        analyses = {
            "legacy_string": await _insert_analysis(session, user_id, ["vitis_legacy"]),
            "digit_string": await _insert_analysis(session, user_id, [str(vitis)]),
            "json_integer": await _insert_analysis(session, user_id, [vitis]),
            "native": await _insert_analysis(session, user_id, [str(native)]),
            "multi": await _insert_analysis(
                session, user_id, ["vitis_legacy", "malus_legacy"]
            ),
            "empty": await _insert_analysis(session, user_id, []),
        }

        await session.commit()

    return {
        "user_id": user_id,
        "subtractions": {"vitis": vitis, "malus": malus, "native": native},
        "analyses": analyses,
    }


class TestBackfill:
    """The backfill resolves each reference form to an integer subtraction id."""

    async def test_legacy_string_resolves(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(
            ctx, seeded["analyses"]["legacy_string"]
        ) == [
            seeded["subtractions"]["vitis"],
        ]

    async def test_digit_string_resolves(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(
            ctx, seeded["analyses"]["digit_string"]
        ) == [
            seeded["subtractions"]["vitis"],
        ]

    async def test_json_integer_resolves(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(
            ctx, seeded["analyses"]["json_integer"]
        ) == [
            seeded["subtractions"]["vitis"],
        ]

    async def test_native_subtraction_resolves(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(ctx, seeded["analyses"]["native"]) == [
            seeded["subtractions"]["native"],
        ]

    async def test_multiple_references_resolve(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(
            ctx, seeded["analyses"]["multi"]
        ) == sorted(
            [seeded["subtractions"]["vitis"], seeded["subtractions"]["malus"]],
        )

    async def test_empty_array_links_nothing(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        assert await _linked_subtraction_ids(ctx, seeded["analyses"]["empty"]) == []

    async def test_rerun_is_idempotent(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        async with AsyncSession(ctx.pg) as session:
            await session.execute(text(BACKFILL_SQL))
            await session.commit()

        assert await _linked_subtraction_ids(
            ctx, seeded["analyses"]["multi"]
        ) == sorted(
            [seeded["subtractions"]["vitis"], seeded["subtractions"]["malus"]],
        )


class TestDropColumn:
    """The third revision drops the JSONB column once the backfill is complete."""

    async def test_column_is_dropped(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, DROP_REVISION)

        async with AsyncSession(ctx.pg) as session:
            column_count = (
                await session.execute(
                    text("""
                        SELECT count(*) FROM information_schema.columns
                        WHERE table_name = 'analyses'
                          AND column_name = 'subtractions'
                    """),
                )
            ).scalar_one()

        assert column_count == 0

    async def test_tripwire_raises_on_unmigrated_reference(
        self, ctx: MigrationContext, seeded: dict, apply_alembic: Callable
    ):
        await asyncio.to_thread(apply_alembic, BACKFILL_REVISION)

        async with AsyncSession(ctx.pg) as session:
            await _insert_analysis(session, seeded["user_id"], ["vitis_legacy"])
            await session.commit()

        with pytest.raises(RuntimeError, match="missing from analysis_subtractions"):
            await asyncio.to_thread(apply_alembic, DROP_REVISION)
