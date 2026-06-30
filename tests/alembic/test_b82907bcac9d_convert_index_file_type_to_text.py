import asyncio
from pathlib import Path

import alembic.command
import alembic.config
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

DOWN_REVISION = "2b53ffa573a3"
REVISION = "b82907bcac9d"


def _downgrade(revision: str) -> None:
    alembic.command.downgrade(
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
    )


async def _insert_index_file(
    session: AsyncSession,
    name: str,
    file_type: str,
) -> None:
    await session.execute(
        text(
            'INSERT INTO index_files (name, "index", type, size) '
            "VALUES (:name, 'test_index', :type, 100)",
        ),
        {"name": name, "type": file_type},
    )


async def test_upgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        await _insert_index_file(session, "reference.json.gz", "json")
        await _insert_index_file(session, "reference.fa.gz", "fasta")
        await _insert_index_file(session, "reference.1.bt2", "bowtie2")
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        await _insert_index_file(session, "reference.ndjson.gz", "ndjson")
        await session.commit()

        result = await session.execute(
            text("SELECT name, type FROM index_files ORDER BY name"),
        )
        assert result.all() == [
            ("reference.1.bt2", "bowtie2"),
            ("reference.fa.gz", "fasta"),
            ("reference.json.gz", "json"),
            ("reference.ndjson.gz", "ndjson"),
        ]

        column_type = await session.execute(
            text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'index_files' AND column_name = 'type'",
            ),
        )
        assert column_type.scalar_one() == "text"

        enum_count = await session.execute(
            text("SELECT COUNT(*) FROM pg_type WHERE typname = 'indextype'"),
        )
        assert enum_count.scalar_one() == 0

    with pytest.raises(IntegrityError):
        async with AsyncSession(migration_pg) as session:
            await _insert_index_file(session, "invalid", "invalid")
            await session.commit()


async def test_downgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(migration_pg) as session:
        await _insert_index_file(session, "reference.ndjson.gz", "ndjson")
        await session.commit()

    await asyncio.to_thread(_downgrade, DOWN_REVISION)

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            text("SELECT name, type::text FROM index_files ORDER BY name"),
        )
        assert result.all() == [("reference.ndjson.gz", "json")]

        column_type = await session.execute(
            text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_name = 'index_files' AND column_name = 'type'",
            ),
        )
        assert column_type.scalar_one() == "indextype"
