"""Add archived to references.

Revision ID: g2cecswiq3r2
Date: 2026-04-24 20:04:03.395399
"""

import arrow

from virtool.migration import MigrationContext

name = "add archived to references"
created_at = arrow.get("2026-04-24 20:04:03.395399")
revision_id = "g2cecswiq3r2"

alembic_down_revision = None
virtool_down_revision = "ie7r3vdaf5mu"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill ``archived`` on reference documents that predate the field."""
    await ctx.mongo.references.update_many(
        {"archived": {"$exists": False}},
        {"$set": {"archived": False}},
    )
