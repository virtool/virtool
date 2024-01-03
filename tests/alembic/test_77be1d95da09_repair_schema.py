import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.groups.pg import SQLGroup


async def test_upgrade(
    all_permissions: dict,
    apply_alembic: callable,
    migration_pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    await asyncio.to_thread(apply_alembic, "8f3810c1c2c9")

    async with AsyncSession(migration_pg) as session:
        session.add_all(
            [
                SQLGroup(name="Foo", permissions=all_permissions),
                SQLGroup(name="Bar", permissions=all_permissions),
                SQLGroup(name="Baz", permissions=all_permissions),
                SQLGroup(name="Baz", permissions=all_permissions),
                SQLGroup(name="Loo", permissions=all_permissions),
                SQLGroup(name="Foo", permissions=all_permissions),
                SQLGroup(name="Boo", permissions=all_permissions),
                SQLGroup(name="Foo", permissions=all_permissions),
            ]
        )

        await session.commit()

    await asyncio.to_thread(apply_alembic, "77be1d95da09")

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            select(SQLGroup.id, SQLGroup.name).order_by(SQLGroup.id)
        )

        assert [r for r in result.all()] == snapshot
