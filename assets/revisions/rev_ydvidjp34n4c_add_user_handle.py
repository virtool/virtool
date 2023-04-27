"""
Add user handle

Revision ID: ydvidjp34n4c
Date: 2022-06-15 15:39:58.662302

"""
import re
from random import randint

import arrow
import pytest
from motor.motor_asyncio import AsyncIOMotorClientSession

# Revision identifiers.
from syrupy.filters import props

from virtool.migration.ctx import RevisionContext

name = "Add user handle"
created_at = arrow.get("2022-06-15 15:39:58.662302")
revision_id = "ydvidjp34n4c"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    async for document in ctx.mongo.database.users.find(
        {"handle": {"$exists": False}}, session=ctx.mongo.session
    ):
        user_id = document["_id"]

        if "b2c_given_name" in document and "b2c_family_name" in document:
            handle = await _generate_user_handle(
                ctx.mongo.database,
                document["b2c_given_name"],
                document["b2c_family_name"],
                ctx.mongo.session
            )
        else:
            handle = user_id

        await ctx.mongo.database.users.update_one(
            {"_id": user_id}, {"$set": {"handle": handle}}, session=ctx.mongo.session
        )


async def _generate_user_handle(
    motor_db, given_name: str, family_name: str, session: AsyncIOMotorClientSession
) -> str:
    """
    Create handle for new B2C users in Virtool using values from ID token and random
    integer.

    :param collection: the mongo collection to check for existing usernames
    :param given_name: user's first name collected from Azure AD B2C
    :param family_name: user's last name collected from Azure AD B2C
    :param session: a Motor session to use
    :return: user handle created from B2C user info
    """
    handle = f"{given_name}-{family_name}-{randint(1, 100)}"

    if await motor_db.users.count_documents({"handle": handle}, session):
        return await _generate_user_handle(motor_db, given_name, family_name, session)

    return handle


@pytest.mark.parametrize("user", ["ad_user", "existing_user", "user_with_handle"])
async def test_upgrade(ctx, snapshot, user):
    document = {"_id": "abc123"}

    if user == "ad_user":
        document.update({"b2c_given_name": "foo", "b2c_family_name": "bar"})

    if user == "user_with_handle":
        document["handle"] = "bar"

    await ctx.mongo.database.users.insert_one(document)

    await upgrade(ctx)

    document = await ctx.mongo.database.users.find_one({"_id": "abc123"})

    if user == "ad_user":
        if "handle" in document:
            assert re.match(r"foo-bar-\d+", document["handle"])
        assert document == snapshot(
            exclude=props(
                "handle",
            )
        )
    else:
        assert document == snapshot
