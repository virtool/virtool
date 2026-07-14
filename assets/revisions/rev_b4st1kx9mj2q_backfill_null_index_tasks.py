"""Backfill null index tasks.

Revision ID: b4st1kx9mj2q
Date: 2026-06-22 12:00:00.000000

"""

import arrow

from virtool.migration import MigrationContext

name = "backfill null index tasks"
created_at = arrow.get("2026-06-22 12:00:00.000000")
revision_id = "b4st1kx9mj2q"

alembic_down_revision = None
virtool_down_revision = "n03aryu6frku"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Populate ``task`` on legacy index documents that predate the field."""
    await ctx.mongo.indexes.update_many(
        {"task": {"$exists": False}},
        {"$set": {"task": None}},
    )
