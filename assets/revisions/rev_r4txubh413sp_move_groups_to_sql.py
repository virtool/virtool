"""
Move groups to SQL

Revision ID: r4txubh413sp
Date: 2023-08-08 21:57:09.069211

"""
import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext

# Revision identifiers.
name = "Move groups to SQL"
created_at = arrow.get("2023-08-08 21:57:09.069211")
revision_id = "r4txubh413sp"

alembic_down_revision = "e694fb270acb"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """
    Move groups to SQL.

    Some groups may already exist in both databases. In this case, no action is taken.
    """
    async with AsyncSession(ctx.pg) as session:
        async for old_group in ctx.mongo.groups.find({}):
            group = (
                await session.execute(
                    select(SQLGroup).where(SQLGroup.legacy_id == old_group["_id"])
                )
            ).one_or_none()

            if not group:
                session.add(
                    SQLGroup(
                        legacy_id=old_group["_id"],
                        name=old_group["name"],
                        permissions=old_group["permissions"],
                    )
                )

        await session.commit()


async def test_upgrade(ctx: MigrationContext, snapshot):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLGroup.metadata.create_all)
        await conn.commit()

    await ctx.mongo.groups.insert_many(
        [
            {
                "_id": "group_1",
                "name": "Group 1",
                "permissions": {"create_sample": True},
            },
            {
                "_id": "group_2",
                "name": "Group 2",
                "permissions": {"create_sample": False},
            },
            {
                "_id": "group_3",
                "name": "Group 3",
                "permissions": {"create_sample": True},
            },
            {
                "_id": "group_4",
                "name": "Group 4",
                "permissions": {"create_sample": False},
            },
        ]
    )

    async with AsyncSession(ctx.pg) as session:
        session.add(
            SQLGroup(
                legacy_id="group_3", name="Group 3", permissions={"create_sample": True}
            )
        )
        await session.commit()

    await upgrade(ctx)

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(select(SQLGroup))
        snapshot.assert_match(result.scalars().all())
