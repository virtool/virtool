import random
from asyncio import gather
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.errors import DuplicateKeyError

import virtool.utils
from virtool.data.errors import ResourceConflictError
from virtool.mongo.core import Mongo
from virtool.types import Document
from virtool.users.db import B2CUserAttributes
from virtool.users.utils import (
    hash_password,
    check_password,
    check_legacy_password,
    limit_permissions,
)


async def create_user(
    mongo: Mongo,
    handle: str,
    password: Optional[str],
    force_reset: bool,
    b2c_user_attributes: Optional[B2CUserAttributes] = None,
    session: Optional[AsyncIOMotorClientSession] = None,
) -> Document:
    document = {
        "handle": handle,
        "administrator": False,
        "groups": [],
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_workflow": "pathoscope_bowtie",
        },
        "primary_group": None,
        "force_reset": force_reset,
        "last_password_change": virtool.utils.timestamp(),
        "invalidate_sessions": False,
        "active": True,
    }

    if password is None:
        if b2c_user_attributes is None:
            raise ValueError("Missing b2c_user_attributes")

        if await mongo.users.count_documents(
            {"b2c_oid": b2c_user_attributes.oid}, limit=1
        ):
            raise ResourceConflictError("User oid already exists")

        document.update(
            {
                "b2c_oid": b2c_user_attributes.oid,
                "b2c_display_name": b2c_user_attributes.display_name,
                "b2c_given_name": b2c_user_attributes.given_name,
                "b2c_family_name": b2c_user_attributes.family_name,
            }
        )
    else:
        document["password"] = hash_password(password)

    try:
        return await mongo.users.insert_one(document, session=session)
    except DuplicateKeyError:
        raise ResourceConflictError("User already exists")


async def validate_credentials(mongo: "Mongo", user_id: str, password: str) -> bool:
    """
    Check if the ``user_id`` and ``password`` are valid.

    Returns ``True`` if the username exists and the password is correct. Returns
    ``False`` if the username does not exist or the password is incorrect.

    :param mongo: a database client
    :param user_id: the username to check.
    :param password: the password to check.
    :return: validation success

    """
    document = await mongo.users.find_one(user_id, ["password", "salt"])

    if not document:
        return False

    # Return True if the attempted password matches the stored password.
    try:
        if check_password(password, document["password"]):
            return True
    except TypeError:
        pass

    if "salt" in document and check_legacy_password(
        password, document["salt"], document["password"]
    ):
        return True

    return False


async def update_keys(
    mongo: "Mongo",
    user_id: str,
    administrator: bool,
    groups: list,
    permissions: dict,
    session: AsyncIOMotorClientSession | None = None,
):
    """

    :param mongo: a database client
    :param user_id: the id of the user to update keys and session for
    :param administrator: the administrator flag for the user
    :param groups: an updated list of groups
    :param permissions: an updated set of permissions derived from the updated groups
    :param session: an option Motor session to use

    """
    await gather(
        *[
            mongo.keys.update_one(
                {"_id": document["_id"]},
                {
                    "$set": {
                        "administrator": administrator,
                        "groups": groups,
                        "permissions": limit_permissions(
                            document["permissions"], permissions
                        ),
                    }
                },
                session=session,
            )
            async for document in mongo.keys.find(
                {"user.id": user_id}, ["permissions"], session=session
            )
        ]
    )


async def generate_handle(collection, given_name: str, family_name: str) -> str:
    """
    Create handle for new B2C users in Virtool using values from ID token and random
    integer.

    :param collection: the mongo collection to check for existing usernames
    :param given_name: user's first name collected from Azure AD B2C
    :param family_name: user's last name collected from Azure AD B2C

    :return: user handle created from B2C user info
    """
    handle = f"{given_name}-{family_name}-{random.randint(1, 100)}"

    if await collection.count_documents({"handle": handle}):
        return await generate_handle(collection, given_name, family_name)

    return handle
