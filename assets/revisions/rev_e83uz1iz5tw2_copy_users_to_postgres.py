"""copy users to postgres

Revision ID: e83uz1iz5tw2
Date: 2024-12-09 21:39:37.692957

"""

import arrow
from asyncpg.exceptions import UniqueViolationError
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext
from virtool.users.pg import SQLUser, SQLUserGroup

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
            sql_user = SQLUser(
                active=user["active"],
                b2c_display_name=user.get("b2c_display_name"),
                b2c_given_name=user.get("b2c_given_name"),
                b2c_family_name=user.get("b2c_family_name"),
                b2c_oid=user.get("b2c_oid"),
                email=user.get("email"),
                force_reset=user["force_reset"],
                handle=user["handle"],
                invalidate_sessions=user["invalidate_sessions"],
                last_password_change=user["last_password_change"],
                legacy_id=user["_id"],
                password=user["password"],
                settings=user["settings"],
            )

            session.add(sql_user)

            try:
                await session.flush()

            except IntegrityError as e:
                if e.orig.pgcode == UniqueViolationError.sqlstate:
                    continue
                raise

            if groups := user["groups"]:
                await session.execute(
                    insert(SQLUserGroup).values(
                        [
                            {
                                "user_id": sql_user.id,
                                "group_id": group,
                                "primary": user["primary_group"] == group,
                            }
                            for group in groups
                        ],
                    ),
                )

            await session.commit()
