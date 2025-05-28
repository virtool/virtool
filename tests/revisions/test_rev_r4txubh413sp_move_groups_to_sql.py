from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_r4txubh413sp_move_groups_to_sql import upgrade
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext


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
            {
                "_id": "group 5 (legacy)",
                "permissions": {"create_sample": False},
            },
        ],
    )

    async with AsyncSession(ctx.pg) as session:
        session.add(
            SQLGroup(
                legacy_id="group_3",
                name="Group 3",
                permissions={"create_sample": True},
            ),
        )
        await session.commit()

    await upgrade(ctx)

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(select(SQLGroup))
        snapshot.assert_match(result.scalars().all())
