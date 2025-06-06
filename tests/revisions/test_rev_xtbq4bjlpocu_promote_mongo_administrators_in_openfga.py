from assets.revisions.rev_xtbq4bjlpocu_promote_mongo_administrators_in_openfga import (
    upgrade,
)
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.migration import MigrationContext
from virtool.models.roles import AdministratorRole


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.users.insert_many(
        [
            {"_id": "full_admin_1", "administrator": True},
            {"_id": "full_admin_2", "administrator": True},
            {"_id": "spaces_admin_1", "administrator": False},
            {"_id": "user_2", "administrator": False},
        ],
    )

    await ctx.authorization.add(
        AdministratorRoleAssignment("full_admin_1", AdministratorRole.FULL),
    )

    await ctx.authorization.add(
        AdministratorRoleAssignment("spaces_admin_1", AdministratorRole.SPACES),
    )

    await upgrade(ctx)

    assert await ctx.mongo.users.find().to_list(None) == snapshot(name="mongo")
    assert await ctx.authorization.list_administrators() == snapshot(name="openfga")
