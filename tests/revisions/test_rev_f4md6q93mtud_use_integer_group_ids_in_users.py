from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_f4md6q93mtud_use_integer_group_ids_in_users import upgrade
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext


async def test_upgrade(
    ctx: MigrationContext,
    no_permissions: dict[str, bool],
    snapshot,
):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLGroup.metadata.create_all)
        await conn.commit()

    async with AsyncSession(ctx.pg) as session:
        session.add_all(
            [
                SQLGroup(
                    id=1,
                    name="Group 1",
                    legacy_id="group_1",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    id=2,
                    name="Group 2",
                    legacy_id="group_2",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    id=3,
                    name="Group 3",
                    legacy_id="group_3",
                    permissions=no_permissions,
                ),
            ],
        )

        await session.commit()

    await ctx.mongo.users.insert_many(
        [
            {"_id": "bob", "groups": [1, 3], "primary_group": "group_1"},
            {
                "_id": "joe",
                "groups": [],
                "primary_group": 2,
            },
            {
                "_id": "kim",
                "groups": [3, 2],
                "primary_group": 3,
            },
            # Should not have duplicate group_2 / 2 ids.
            {
                "_id": "moe",
                "groups": [1, "group_2", 2],
                "primary_group": None,
            },
            {
                "_id": "roz",
                "groups": ["group_3"],
                "primary_group": "none",
            },
            # Should have empty groups list and unset primary_group because group_5 does
            # not exist.
            {
                "_id": "tim",
                "groups": ["group_5"],
                "primary_group": 5,
            },
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find({}).to_list(None) == snapshot(name="mongo")
