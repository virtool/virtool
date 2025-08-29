"""Use integer ids for reference groups

Revision ID: okd9db53g0il
Date: 2023-10-13 18:23:07.429533

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "Use integer nested group ids"
created_at = arrow.get("2023-10-13 18:23:07.429533")
revision_id = "okd9db53g0il"

alembic_down_revision = "f8ad70032e9c"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT id, legacy_id FROM groups WHERE legacy_id IS NOT NULL")
        )

        group_id_map: dict[str, int] = {
            row.legacy_id: row.id for row in result.fetchall()
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
            {"_id": document["_id"]},
            {"$set": {"groups": list(groups.values())}},
        )
