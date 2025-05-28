"""Use integer group ids in samples

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
            {"_id": document["_id"]},
            {"$set": {"group": group}},
        )
