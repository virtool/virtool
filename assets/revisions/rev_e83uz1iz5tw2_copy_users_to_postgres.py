"""copy users to postgres

Revision ID: e83uz1iz5tw2
Date: 2024-12-09 21:39:37.692957

"""

import arrow
import pytest
from sqlalchemy import Select, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.core import StaticTime
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


async def upgrade(ctx: MigrationContext):
    async for user in ctx.mongo.users.find({}):
        async with AsyncSession(ctx.pg) as session:
            if (
                await session.execute(
                    Select(SQLUser).where(SQLUser.legacy_id == user["_id"]),
                )
            ).scalar():
                continue

            sqluser = SQLUser(
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

            session.add(sqluser)

            await session.flush()

            if groups := user["groups"]:
                await session.execute(
                    insert(SQLUserGroup).values(
                        [
                            {
                                "user_id": sqluser.id,
                                "group_id": group,
                                "primary": user["primary_group"] == group,
                            }
                            for group in groups
                        ],
                    ),
                )

            await session.commit()


class TestUpgrade:
    @pytest.fixture(autouse=True)
    async def setup_postgres(self, ctx: MigrationContext):
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLGroup.metadata.create_all)
            await conn.run_sync(SQLUserGroup.metadata.create_all)
            await conn.run_sync(SQLUser.metadata.create_all)
            await conn.commit()

    @pytest.fixture()
    def verify_snapshots(self, ctx: MigrationContext, snapshot: SnapshotAssertion):
        async def func():
            async with AsyncSession(ctx.pg) as session:
                users = (
                    (await session.execute(select(SQLUser))).unique().scalars().all()
                )
                assert users == snapshot

        return func

    @pytest.fixture()
    def base_user(self, static_time):
        return {
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

    @staticmethod
    async def test_upgrade(base_user, ctx: MigrationContext, verify_snapshots):
        """Verify a basic mongo user without groups is correctly migrated to postgres"""
        await ctx.mongo.users.insert_one(base_user)
        await upgrade(ctx)
        await verify_snapshots()

    @staticmethod
    async def test_upgrade_groups(
        base_user,
        ctx: MigrationContext,
        verify_snapshots,
    ):
        """Verify a mongo user with groups is correctly migrated to postgres"""
        async with AsyncSession(ctx.pg) as session:
            group = SQLGroup(name="test_group", permissions={})
            session.add(group)

            await session.flush()

            user = {**base_user, "groups": [group.id], "primary_group": group.id}

            await session.commit()

        await ctx.mongo.users.insert_one(user)

        await upgrade(ctx)

        await verify_snapshots()

    @staticmethod
    async def test_upgrade_existing_sql_user(
        base_user,
        ctx: MigrationContext,
        verify_snapshots,
        static_time: StaticTime,
    ):
        """Verify that users that have both mongo and postgres records are
        not migrated
        """
        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLUser(
                    legacy_id=base_user["_id"],
                    force_reset=False,
                    handle="pre-existing sql user",
                    last_password_change=static_time.datetime,
                    password=b"hashed_password",
                    settings={},
                ),
            )
            await session.commit()

        await ctx.mongo.users.insert_one(base_user)

        await upgrade(ctx)

        await verify_snapshots()
