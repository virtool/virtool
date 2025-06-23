"""copy users to postgres

Revision ID: e83uz1iz5tw2
Date: 2024-12-09 21:39:37.692957

"""

import json

import arrow
from asyncpg.exceptions import UniqueViolationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "copy users to postgres"
created_at = arrow.get("2024-12-09 21:39:37.692957")
revision_id = "e83uz1iz5tw2"

alembic_down_revision = None
virtool_down_revision = "oxu8ghlvuqmh"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Copy users from mongodb to postgres."""
    async for user in ctx.mongo.users.find({}):
        async with AsyncSession(ctx.pg) as session:
            try:
                # Insert user and get the ID
                result = await session.execute(
                    text("""
                        INSERT INTO users (
                            active, b2c_display_name, b2c_given_name, b2c_family_name, 
                            b2c_oid, email, force_reset, handle, invalidate_sessions, 
                            last_password_change, legacy_id, password, settings
                        )
                        VALUES (
                            :active, :b2c_display_name, :b2c_given_name, :b2c_family_name,
                            :b2c_oid, :email, :force_reset, :handle, :invalidate_sessions,
                            :last_password_change, :legacy_id, :password, :settings
                        )
                        RETURNING id
                    """),
                    {
                        "active": user["active"],
                        "b2c_display_name": user.get("b2c_display_name") or "",
                        "b2c_given_name": user.get("b2c_given_name") or "",
                        "b2c_family_name": user.get("b2c_family_name") or "",
                        "b2c_oid": user.get("b2c_oid"),
                        "email": user.get("email") or "",
                        "force_reset": user["force_reset"],
                        "handle": user["handle"],
                        "invalidate_sessions": user["invalidate_sessions"],
                        "last_password_change": user["last_password_change"],
                        "legacy_id": user["_id"],
                        "password": user["password"],
                        "settings": json.dumps(user["settings"]),
                    },
                )
                user_id = result.scalar()

            except IntegrityError as e:
                if e.orig.pgcode == UniqueViolationError.sqlstate:
                    continue
                raise

            if groups := user["groups"]:
                # Insert user-group relationships
                for group in groups:
                    await session.execute(
                        text("""
                            INSERT INTO user_groups (user_id, group_id, "primary")
                            VALUES (:user_id, :group_id, :primary)
                        """),
                        {
                            "user_id": user_id,
                            "group_id": group,
                            "primary": user["primary_group"] == group,
                        },
                    )

            await session.commit()
