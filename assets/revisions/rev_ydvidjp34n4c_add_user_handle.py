"""Add user handle

Revision ID: ydvidjp34n4c
Date: 2022-06-15 15:39:58.662302

"""

from random import randint

import arrow

# Revision identifiers.
from virtool.migration import MigrationContext

name = "Add user handle"
created_at = arrow.get("2022-06-15 15:39:58.662302")
revision_id = "ydvidjp34n4c"

alembic_down_revision = None
virtool_down_revision = "gr5j6jx8ap7f"


async def upgrade(ctx: MigrationContext):
    async for document in ctx.mongo.users.find({"handle": {"$exists": False}}):
        user_id = document["_id"]

        if "b2c_given_name" in document and "b2c_family_name" in document:
            handle = await _generate_user_handle(
                ctx.mongo,
                document["b2c_given_name"],
                document["b2c_family_name"],
            )
        else:
            handle = user_id

        await ctx.mongo.users.update_one({"_id": user_id}, {"$set": {"handle": handle}})

    if await ctx.mongo.users.count_documents({"handle": {"$exists": False}}):
        raise Exception("Some users still do not have a handle")


async def _generate_user_handle(motor_db, given_name: str, family_name: str) -> str:
    """Create handle for new B2C users in Virtool using values from ID token and random
    integer.

    :param motor_db: the mongo collection to check for existing usernames
    :param given_name: user's first name collected from Azure AD B2C
    :param family_name: user's last name collected from Azure AD B2C
    :return: user handle created from B2C user info
    """
    handle = f"{given_name}-{family_name}-{randint(1, 100)}"

    if await motor_db.users.count_documents({"handle": handle}):
        return await _generate_user_handle(motor_db, given_name, family_name)

    return handle
