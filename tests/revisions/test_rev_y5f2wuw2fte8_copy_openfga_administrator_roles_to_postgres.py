"""copy openfga administrator roles to postgres

Revision ID: y5f2wuw2fte8
Date: 2025-09-15 21:35:21.415101

"""

from collections.abc import Awaitable, Callable, Sequence

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from assets.revisions.rev_y5f2wuw2fte8_copy_openfga_administrator_roles_to_postgres import (
    upgrade,
)
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.migration import MigrationContext
from virtool.models.roles import AdministratorRole


class TestUpgrade:
    """Verify that administrator roles are correctly copied from OpenFGA to Postgres."""

    fetch_users: Callable[[], Awaitable[Sequence[dict]]]

    @pytest.fixture(autouse=True)
    async def setup(self, ctx: MigrationContext, static_time):
        """Ensure the environment is set up for each test."""
        # Create the enum type if it doesn't exist
        async with ctx.pg.begin() as conn:
            # Check if type exists
            result = await conn.execute(
                text("SELECT 1 FROM pg_type WHERE typname = 'administratorrole'")
            )
            if not result.fetchone():
                await conn.execute(
                    text(
                        "CREATE TYPE administratorrole AS ENUM ('full', 'settings', 'spaces', 'users', 'base')"
                    )
                )
            await conn.commit()

        # Create the user tables using raw SQL to avoid enum mapping issues
        async with ctx.pg.begin() as conn:
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    handle VARCHAR NOT NULL UNIQUE,
                    legacy_id VARCHAR UNIQUE,
                    last_password_change TIMESTAMP NOT NULL,
                    password BYTEA,
                    settings JSONB NOT NULL,
                    administrator_role administratorrole
                )
            """)
            )
            await conn.commit()

        async def fetch_users() -> Sequence[dict]:
            async with AsyncSession(ctx.pg) as session:
                result = await session.execute(
                    text(
                        "SELECT id, handle, legacy_id, administrator_role FROM users ORDER BY id"
                    )
                )
                return [
                    {
                        "id": r.id,
                        "handle": r.handle,
                        "legacy_id": r.legacy_id,
                        "administrator_role": r.administrator_role,
                    }
                    for r in result.fetchall()
                ]

        self.fetch_users = fetch_users

    async def test_upgrade(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
        static_time,
    ) -> None:
        """Verify administrator roles are copied from OpenFGA to Postgres."""
        # Create users in Postgres using raw SQL
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                INSERT INTO users (handle, legacy_id, last_password_change, password, settings)
                VALUES
                    ('full_admin', 'full_admin_1', :time, :password, :settings),
                    ('spaces_admin', 'spaces_admin_1', :time, :password, :settings),
                    ('regular_user', 'user_1', :time, :password, :settings),
                    ('no_legacy_id', NULL, :time, :password, :settings)
            """),
                {
                    "time": static_time.datetime,
                    "password": b"password",
                    "settings": "{}",
                },
            )
            await session.commit()

        # Set up administrator roles in OpenFGA
        await ctx.authorization.add(
            AdministratorRoleAssignment("full_admin_1", AdministratorRole.FULL),
            AdministratorRoleAssignment("spaces_admin_1", AdministratorRole.SPACES),
        )

        await upgrade(ctx)

        assert await self.fetch_users() == snapshot

    async def test_upgrade_no_roles(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
        static_time,
    ) -> None:
        """Verify users without administrator roles are left unchanged."""
        # Create users in Postgres without any administrator roles in OpenFGA
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                INSERT INTO users (handle, legacy_id, last_password_change, password, settings)
                VALUES
                    ('user_1', 'user_1', :time, :password, :settings),
                    ('user_2', 'user_2', :time, :password, :settings)
            """),
                {
                    "time": static_time.datetime,
                    "password": b"password",
                    "settings": "{}",
                },
            )
            await session.commit()

        await upgrade(ctx)

        assert await self.fetch_users() == snapshot

    async def test_upgrade_existing_role(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
        static_time,
    ) -> None:
        """Verify users with existing roles in Postgres are updated correctly."""
        # Create user in Postgres with existing administrator role
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                INSERT INTO users (handle, legacy_id, last_password_change, password, settings, administrator_role)
                VALUES ('admin_user', 'admin_1', :time, :password, :settings, 'base')
            """),
                {
                    "time": static_time.datetime,
                    "password": b"password",
                    "settings": "{}",
                },
            )
            await session.commit()

        # Set up different administrator role in OpenFGA
        await ctx.authorization.add(
            AdministratorRoleAssignment("admin_1", AdministratorRole.FULL),
        )

        await upgrade(ctx)

        assert await self.fetch_users() == snapshot
