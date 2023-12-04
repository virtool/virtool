"""
Use integer ids for reference groups

Revision ID: okd9db53g0il
Date: 2023-10-13 18:23:07.429533

"""
import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext

# Revision identifiers.
name = "Use integer nested group ids"
created_at = arrow.get("2023-10-13 18:23:07.429533")
revision_id = "okd9db53g0il"

alembic_down_revision = "f8ad70032e9c"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(select(SQLGroup))

        group_id_map: dict[str, int] = {
            group.legacy_id: group.id
            for group in result.scalars()
            if group.legacy_id is not None
        }

    if not group_id_map:
        return

    async for document in ctx.mongo.references.find({"groups.0": {"$exists": True}}):
        groups = {}

        for group in document["groups"]:
            if isinstance(group["id"], str):
                group_id = group_id_map[group["id"]]
            else:
                group_id = group["id"]

            if group_id not in groups:
                groups[group_id] = {**group, "id": group_id}
            else:
                groups[group_id] = {
                    **{
                        key: groups[group_id][key] or group[key]
                        for key in ("build", "modify", "modify_otu", "remove")
                    },
                    "id": group_id,
                }

        await ctx.mongo.references.update_one(
            {"_id": document["_id"]}, {"$set": {"groups": list(groups.values())}}
        )


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
            ]
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
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.references.find({}).to_list(None) == snapshot(name="mongo")
