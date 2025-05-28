"""copy users to postgres

Revision ID: e83uz1iz5tw2
Date: 2024-12-09 21:39:37.692957

"""

from collections.abc import Awaitable, Callable, Sequence

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from assets.revisions.rev_e83uz1iz5tw2_copy_users_to_postgres import upgrade
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext
from virtool.types import Document
from virtool.users.pg import SQLUser, SQLUserGroup


class TestUpgrade:
    """Verify that users are correctly moved to postgres."""

    base_user: Document
    fetch_users: Callable[[], Awaitable[Sequence[SQLUser]]]

    @pytest.fixture(autouse=True)
    async def setup(self, ctx: MigrationContext, static_time):
        """Ensure the environment is set up for each test."""
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLGroup.metadata.create_all)
            await conn.run_sync(SQLUserGroup.metadata.create_all)
            await conn.run_sync(SQLUser.metadata.create_all)
            await conn.commit()

        self.base_user = {
            "_id": "9SYJ3IWB",
            "active": True,
            "force_reset": False,
            "groups": [],
            "handle": "modern_user",
            "invalidate_sessions": False,
            "last_password_change": static_time.datetime,
            "password": b"hashed_password",
            "primary_group": None,
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie",
            },
        }

        async def fetch_users() -> Sequence[SQLUser]:
            async with AsyncSession(ctx.pg) as session:
                return (await session.execute(select(SQLUser))).unique().scalars().all()

        self.fetch_users = fetch_users

    async def test_upgrade(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
    ) -> None:
        """Verify a mongo user without groups is correctly migrated to postgres."""
        await ctx.mongo.users.insert_one(self.base_user)
        await upgrade(ctx)
        assert await self.fetch_users() == snapshot

    async def test_upgrade_groups(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
    ) -> None:
        """Verify a mongo user with groups is correctly migrated to postgres."""
        async with AsyncSession(ctx.pg) as session:
            group = SQLGroup(name="test_group", permissions={})
            session.add(group)

            await session.flush()

            user = {**self.base_user, "groups": [group.id], "primary_group": group.id}

            await session.commit()

        await ctx.mongo.users.insert_one(user)

        await upgrade(ctx)

        assert await self.fetch_users() == snapshot

    async def test_upgrade_existing_sql_user(
        self,
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
        static_time,
    ) -> None:
        """Verify that users that have both mongo and postgres records are
        not migrated.
        """
        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLUser(
                    legacy_id=self.base_user["_id"],
                    force_reset=False,
                    handle="pre-existing sql user",
                    last_password_change=static_time.datetime,
                    password=b"hashed_password",
                    settings={},
                ),
            )
            await session.commit()

        await ctx.mongo.users.insert_one(self.base_user)

        await upgrade(ctx)

        assert await self.fetch_users() == snapshot
