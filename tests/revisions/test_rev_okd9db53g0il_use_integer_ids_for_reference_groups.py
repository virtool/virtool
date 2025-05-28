from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_okd9db53g0il_use_integer_ids_for_reference_groups import (
    upgrade,
)
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, no_permissions, snapshot):
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

    await ctx.mongo.references.insert_many(
        [
            {
                "_id": "foo",
                "groups": [
                    {
                        "id": 1,
                        "build": False,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                    {
                        "id": "group_2",
                        "build": False,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
            {
                "_id": "bar",
                "groups": [
                    {
                        "id": 3,
                        "build": False,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                    {
                        "id": "group_1",
                        "build": False,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
            {
                "_id": "baz",
                "groups": [],
            },
            {
                "_id": "foz",
                "groups": [
                    {
                        "id": 1,
                        "build": True,
                        "modify": False,
                        "modify_otu": True,
                        "remove": True,
                    },
                    {
                        "id": "group_2",
                        "build": False,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                    {
                        "id": "group_1",
                        "build": False,
                        "modify": True,
                        "modify_otu": False,
                        "remove": False,
                    },
                ],
            },
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.references.find({}).to_list(None) == snapshot(name="mongo")
