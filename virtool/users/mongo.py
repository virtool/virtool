"""
Utilities for working with users in the database.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""
from __future__ import annotations

import asyncio
import random

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.errors import DuplicateKeyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.errors import ResourceConflictError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.types import Document
from virtool.users.db import B2CUserAttributes, ATTACH_PROJECTION
from virtool.users.utils import (
    hash_password,
    check_password,
    check_legacy_password,
    limit_permissions,
)
from virtool.utils import base_processor


async def compose_primary_group_update(
    mongo: "Mongo",
    pg: AsyncEngine,
    extra_group_ids: list[int | str],
    group_id: int | None,
    user_id: str | None,
) -> Document:
    """
    Compose an update dict for changing a user's `primary_group`.

    If the ``group_id`` is ``None``, no change will be made. If the ``group_id`` is
    ``"none"``, the ``primary_group`` will be set to ``"none"``.

    :param mongo: the application MongoDB client
    :param pg: the application Postgres client
    :param extra_group_ids: a list of group ids that the user is going to be a member of
    :param group_id: the primary group to set for the user
    :param user_id: the id of the user being updated
    :return: an update

    """
    if group_id is None:
        return {}

    if group_id != "none":
        async with AsyncSession(pg) as session:
            group = await session.get(SQLGroup, group_id)

            if not group:
                raise ResourceConflictError(f"Non-existent group: {group_id}")

        if group_id not in extra_group_ids and not await mongo.users.count_documents(
            {"_id": user_id, "groups": group_id}, limit=1
        ):
            raise ResourceConflictError("User is not member of primary group")

    return {"primary_group": group_id}


async def create_user(
    mongo: Mongo,
    handle: str,
    password: str | None,
    force_reset: bool,
    b2c_user_attributes: B2CUserAttributes | None = None,
    session: AsyncIOMotorClientSession | None = None,
) -> Document:
    document = {
        "active": True,
        "administrator": False,
        "force_reset": force_reset,
        "groups": [],
        "handle": handle,
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "primary_group": None,
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_workflow": "pathoscope_bowtie",
        },
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


async def update_keys(
    mongo: "Mongo",
    user_id: str,
    administrator: bool,
    groups: list[int | str],
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
    await asyncio.gather(
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


async def extend_user(mongo: Mongo, user: Document) -> Document:
    user_data = base_processor(
        await mongo.users.find_one(user["id"], ATTACH_PROJECTION)
    )

    return {
        **user,
        **user_data,
    }
