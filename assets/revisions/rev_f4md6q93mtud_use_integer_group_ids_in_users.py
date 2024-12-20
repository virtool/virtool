"""Use integer group ids in users

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
