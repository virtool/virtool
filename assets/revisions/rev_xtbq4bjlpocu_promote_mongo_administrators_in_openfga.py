"""
promote mongo administrators in openFGA

Revision ID: xtbq4bjlpocu
Date: 2023-11-29 16:53:59.196976

"""
import arrow
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.migration import MigrationContext

# Revision identifiers.
name = "promote mongo administrators in openFGA"
created_at = arrow.get("2023-11-29 16:53:59.196976")
revision_id = "xtbq4bjlpocu"

alembic_down_revision = "8f3810c1c2c9"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    for user_id in await ctx.mongo.users.distinct("_id", {"administrator": True}):
        await ctx.authorization.add(
            AdministratorRoleAssignment(user_id, AdministratorRole.FULL)
        )


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.users.insert_many(
        [
            {"_id": "full_admin_1", "administrator": True},
            {"_id": "full_admin_2", "administrator": True},
            {"_id": "spaces_admin_1", "administrator": False},
            {"_id": "user_2", "administrator": False},
        ]
    )

    await ctx.authorization.add(
        AdministratorRoleAssignment("full_admin_1", AdministratorRole.FULL)
    )

    await ctx.authorization.add(
        AdministratorRoleAssignment("spaces_admin_1", AdministratorRole.SPACES)
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find().to_list(None) == snapshot(name="mongo")
    assert await ctx.authorization.list_administrators() == snapshot(name="openfga")
