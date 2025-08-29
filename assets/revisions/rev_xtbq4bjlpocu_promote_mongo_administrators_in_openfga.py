"""promote mongo administrators in openFGA

Revision ID: xtbq4bjlpocu
Date: 2023-11-29 16:53:59.196976

"""

import arrow

from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.migration import MigrationContext
from virtool.models.roles import AdministratorRole

# Revision identifiers.
name = "promote mongo administrators in openFGA"
created_at = arrow.get("2023-11-29 16:53:59.196976")
revision_id = "xtbq4bjlpocu"

alembic_down_revision = "8f3810c1c2c9"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    for user_id in await ctx.mongo.users.distinct("_id", {"administrator": True}):
        await ctx.authorization.add(
            AdministratorRoleAssignment(user_id, AdministratorRole.FULL),
        )
