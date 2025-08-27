"""Use null for unset analysis results fields

Revision ID: i0ljixkr0wxg
Date: 2022-10-03 19:29:47.077288

"""

import arrow

from virtool.migration import MigrationContext, MigrationError

# Revision identifiers.
name = "Use null for unset analysis results fields"
created_at = arrow.get("2022-10-03 19:29:47.077288")
revision_id = "i0ljixkr0wxg"

alembic_down_revision = None
virtool_down_revision = "tlogeiyxl9uz"


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.analyses.update_many(
        {"results": {"$exists": False}},
        {"$set": {"results": None}},
    )

    if await ctx.mongo.analyses.count_documents({"results": {"$exists": False}}):
        raise MigrationError("Some analyses are missing results fields")
