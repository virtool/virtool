"""copy openfga administrator roles to postgres

Revision ID: y5f2wuw2fte8
Date: 2025-09-15 21:35:21.415101

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "copy openfga administrator roles to postgres"
created_at = arrow.get("2025-09-15 21:35:21.415101")
revision_id = "y5f2wuw2fte8"

alembic_down_revision = "c4d8f879657f"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Copy administrator roles from OpenFGA to Postgres."""
    # Get all users from Postgres
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT id, legacy_id FROM users WHERE legacy_id IS NOT NULL")
        )
        users = result.fetchall()

    # For each user, get their administrator role from OpenFGA and update Postgres
    for user in users:
        user_id, role = await ctx.authorization.get_administrator(user.legacy_id)

        if role is not None:
            async with AsyncSession(ctx.pg) as session:
                await session.execute(
                    text("UPDATE users SET administrator_role = :role WHERE id = :id"),
                    {"role": role.value, "id": user.id},
                )
                await session.commit()
