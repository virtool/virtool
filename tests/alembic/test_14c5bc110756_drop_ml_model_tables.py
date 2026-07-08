import asyncio
from pathlib import Path

import alembic.command
import alembic.config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

ML_TABLES = ("ml_models", "ml_model_releases")


def _downgrade(revision: str) -> None:
    """Downgrade to ``revision`` using the SQLALCHEMY_URL set by ``apply_alembic``."""
    alembic.command.downgrade(
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
    )


async def _existing_tables(session: AsyncSession) -> set[str]:
    result = await session.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = ANY(:names)",
        ),
        {"names": list(ML_TABLES)},
    )
    return set(result.scalars().all())


async def _columns(session: AsyncSession, table_name: str) -> set[str]:
    result = await session.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :table_name",
        ),
        {"table_name": table_name},
    )
    return set(result.scalars().all())


async def test_upgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "95ca6fc2a5db")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        assert await _existing_tables(session) == set(ML_TABLES)

    await asyncio.to_thread(apply_alembic, "14c5bc110756")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        assert await _existing_tables(session) == set()


async def test_downgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "14c5bc110756")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        assert await _existing_tables(session) == set()

    await asyncio.to_thread(_downgrade, "95ca6fc2a5db")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        assert await _existing_tables(session) == set(ML_TABLES)

        assert await _columns(session, "ml_models") == {
            "id",
            "created_at",
            "description",
            "name",
        }

        assert await _columns(session, "ml_model_releases") == {
            "id",
            "created_at",
            "download_url",
            "github_url",
            "model_id",
            "name",
            "published_at",
            "ready",
            "size",
        }
