"""
Use integer group ids in users

Revision ID: f4md6q93mtud
Date: 2023-10-16 18:24:33.712184

"""
import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext

# Revision identifiers.
name = "Use integer group ids in users"
created_at = arrow.get("2023-10-16 18:24:33.712184")
revision_id = "f4md6q93mtud"

alembic_down_revision = None
virtool_down_revision = "okd9db53g0il"

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

    async for document in ctx.mongo.users.find({}):
        groups: set[int] = set()

        for group_id in document["groups"]:
            if isinstance(group_id, str):
                group_id = group_id_map.get(group_id)

            if group_id is not None:
                groups.add(group_id)

        if document["primary_group"] in ("", "none"):
            primary_group = None
        elif isinstance(document["primary_group"], str):
            # We'll let this be `None` if we can convert the string to an integer.
            primary_group = group_id_map.get(document["primary_group"])
        else:
            primary_group = document["primary_group"]

        # Unset primary_group if the user is not a member. This shouldn't happen, but
        # we'll be extra careful.
        if primary_group not in groups:
            primary_group = None

        await ctx.mongo.users.update_one(
            {"_id": document["_id"]},
            {"$set": {"groups": list(groups), "primary_group": primary_group}},
        )


async def test_upgrade(
    ctx: MigrationContext, no_permissions: dict[str, bool], snapshot
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
            ]
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
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find({}).to_list(None) == snapshot(name="mongo")
