"""
Give admins full administrator role

Revision ID: okicpu9cagyu
Date: 2023-04-13 21:18:34.804157

"""
import arrow
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.migration import MigrationContext

# Revision identifiers.
name = "Give admins full administrator role"
created_at = arrow.get("2023-04-13 21:18:34.804157")
revision_id = "okicpu9cagyu"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    """Give all users with the legacy administrator flag the full administrator role."""
    user_ids = await ctx.mongo.users.distinct("_id", {"administrator": True})

    if user_ids:
        await ctx.authorization.add(
            *[
                AdministratorRoleAssignment(user_id, AdministratorRole.FULL)
                for user_id in user_ids
            ]
        )
