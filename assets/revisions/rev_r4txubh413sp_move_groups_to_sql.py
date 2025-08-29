"""Move groups to SQL

Revision ID: r4txubh413sp
Date: 2023-08-08 21:57:09.069211

"""

import json

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "Move groups to SQL"
created_at = arrow.get("2023-08-08 21:57:09.069211")
revision_id = "r4txubh413sp"

alembic_down_revision = "814389ec5021"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Move groups to SQL.

    Some groups may already exist in both databases. In this case, no action is taken.
    """
    async with AsyncSession(ctx.pg) as session:
        async for old_group in ctx.mongo.groups.find({}):
            # Check if group already exists
            result = await session.execute(
                text("SELECT id FROM groups WHERE legacy_id = :legacy_id"),
                {"legacy_id": old_group["_id"]},
            )
            existing_group = result.first()

            if not existing_group:
                await session.execute(
                    text("""
                        INSERT INTO groups (legacy_id, name, permissions)
                        VALUES (:legacy_id, :name, :permissions)
                    """),
                    {
                        "legacy_id": old_group["_id"],
                        "name": old_group.get("name") or old_group["_id"],
                        "permissions": json.dumps(old_group["permissions"]),
                    },
                )

        await session.commit()
