"""
Add user active field

Revision ID: tlogeiyxl9uz
Date: 2022-09-29 21:56:37.130137

"""
import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Add user active field"
created_at = arrow.get("2022-09-29 21:56:37.130137")
revision_id = "tlogeiyxl9uz"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    """
    Set the ``active`` field to ``True`` for users that do not have the field.

    This means all users will be active. The application can set the field to ``False``
    in order to deactivate the user account.

    """
    await ctx.mongo.database.users.update_many(
        {"active": {"$exists": False}}, {"$set": {"active": True}}, session=ctx.mongo.session
    )


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.database.users.insert_many(
        [
            {
                "_id": "bob",
                "active": False,
            },
            {
                "_id": "dave",
                "active": True,
            },
            {
                "_id": "fran",
            },
            {
                "_id": "mary",
            },
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.database.users.find().to_list(None) == snapshot
