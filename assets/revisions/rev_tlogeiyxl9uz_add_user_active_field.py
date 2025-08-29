"""Add user active field

Revision ID: tlogeiyxl9uz
Date: 2022-09-29 21:56:37.130137

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "Add user active field"
created_at = arrow.get("2022-09-29 21:56:37.130137")
revision_id = "tlogeiyxl9uz"

alembic_down_revision = None
virtool_down_revision = "ydvidjp34n4c"


async def upgrade(ctx: MigrationContext) -> None:
    """Set the ``active`` field to ``True`` for users that do not have the field.

    This means all users will be active. The application can set the field to ``False``
    in order to deactivate the user account.

    """
    async with (
        await ctx.mongo.client.start_session() as session,
        session.start_transaction(),
    ):
        await ctx.mongo.users.update_many(
            {"active": {"$exists": False}},
            {"$set": {"active": True}},
            session=session,
        )
