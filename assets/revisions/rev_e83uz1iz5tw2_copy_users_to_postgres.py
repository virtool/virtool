"""copy users to postgres

Revision ID: e83uz1iz5tw2
Date: 2024-12-09 21:39:37.692957

"""

from collections.abc import Sequence

import arrow
import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext
from virtool.users.pg import SQLUser, SQLUserGroup

# Revision identifiers.
name = "copy users to postgres"
created_at = arrow.get("2024-12-09 21:39:37.692957")
revision_id = "e83uz1iz5tw2"

alembic_down_revision = None
virtool_down_revision = "oxu8ghlvuqmh"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Copy users from mongodb to postgres."""
    async for user in ctx.mongo.users.find({}):
        async with AsyncSession(ctx.pg) as session:
            sql_user = SQLUser(
                active=user["active"],
                b2c_display_name=user.get("b2c_display_name"),
                b2c_given_name=user.get("b2c_given_name"),
                b2c_family_name=user.get("b2c_family_name"),
                b2c_oid=user.get("b2c_oid"),
                email=user.get("email"),
                force_reset=user["force_reset"],
                handle=user["handle"],
                invalidate_sessions=user["invalidate_sessions"],
                last_password_change=user["last_password_change"],
                legacy_id=user["_id"],
                password=user["password"],
                settings=user["settings"],
            )

            session.add(sql_user)

            try:
                await session.flush()
            except IntegrityError:
                continue

            if groups := user["groups"]:
                await session.execute(
                    insert(SQLUserGroup).values(
                        [
                            {
                                "user_id": sql_user.id,
                                "group_id": group,
                                "primary": user["primary_group"] == group,
                            }
                            for group in groups
                        ],
                    ),
                )

            await session.commit()


class TestUpgrade:
    """Verify that users are correctly moved to postgres."""

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
        """Verify a basic mongo user without groups is correctly migrated to postgres."""
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
