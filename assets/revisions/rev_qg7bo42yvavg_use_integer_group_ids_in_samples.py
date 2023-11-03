"""
Use integer group ids in samples

Revision ID: qg7bo42yvavg
Date: 2023-11-03 17:44:08.949901

"""
import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext

# Revision identifiers.
name = "Use integer group ids in samples"
created_at = arrow.get("2023-11-03 17:44:08.949901")
revision_id = "qg7bo42yvavg"

alembic_down_revision = None
virtool_down_revision = "f4md6q93mtud"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(select(SQLGroup))

        group_id_map: dict[str, int] = {
            g.legacy_id: g.id for g in result.scalars() if g.legacy_id is not None
        }

    async for document in ctx.mongo.samples.find({}, ["group"]):
        if document["group"] in ("", "none", None):
            group: int | None = None
        elif isinstance(document["group"], str):
            # We'll let this be `None` if we can't convert the string to an integer.
            group = group_id_map.get(document["group"])
        else:
            group = document["group"]

        await ctx.mongo.samples.update_one(
            {"_id": document["_id"]}, {"$set": {"group": group}}
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

    await ctx.mongo.samples.insert_many(
        [
            {"_id": "sample_1", "group": 3},
            {"_id": "sample_2", "group": "group_2"},
            {"_id": "sample_3", "group": 1},
            # Should have group `None` since it was "none" before.
            {"_id": "sample_4", "group": "none"},
            # # Should have group `None` since it was `None` before.
            {"_id": "sample_5", "group": None},
            # Should have group `None` since it was "" before.
            {"_id": "sample_6", "group": ""},
            # Should have `None` group since the old id was not in the lookup.
            {"_id": "sample_7", "group": "group_10"},
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.samples.find({}).to_list(None) == snapshot(name="mongo")
