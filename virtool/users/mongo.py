"""Utilities for working with users in the database.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""

import random

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.errors import DuplicateKeyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.errors import ResourceConflictError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.settings import DEFAULT_USER_SETTINGS
from virtool.users.utils import (
    check_legacy_password,
    check_password,
)
from virtool.utils import base_processor


async def compose_primary_group_update(
    mongo: "Mongo",
    pg: AsyncEngine,
    member_group_ids: list[int | str] | None,
    group_id: int,
    user_id: str,
) -> Document:
    """Compose an update dict for changing a user's `primary_group`.

    If the ``group_id`` is ``None``, no change will be made. If the ``group_id`` is
    ``"none"``, the ``primary_group`` will be set to ``"none"``.

    :param mongo: the application MongoDB client
    :param pg: the application Postgres client
    :param member_group_ids: a list of group ids of which the user will be a member
    :param group_id: the primary group to set for the user
    :param user_id: the id of the user being updated
    :return: an update

    """
    if group_id in (None, "none"):
        return {
            "primary_group": None,
        }

    async with AsyncSession(pg) as session:
        group = await session.get(SQLGroup, group_id)

        if not group:
            raise ResourceConflictError(f"Non-existent group: {group_id}")

    if member_group_ids is None:
        member_group_ids = await get_one_field(mongo.users, "groups", user_id)

    if group_id not in member_group_ids:
        raise ResourceConflictError("User is not member of primary group")

    return {"primary_group": group_id}


async def create_user(
    mongo: Mongo,
    handle: str,
    password: str,
    force_reset: bool,
    session: AsyncIOMotorClientSession | None = None,
) -> Document:
    document = {
        "active": True,
        "force_reset": force_reset,
        "groups": [],
        "handle": handle,
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "password": virtool.users.utils.hash_password(password),
        "primary_group": None,
        "settings": DEFAULT_USER_SETTINGS,
    }

    try:
        return await mongo.users.insert_one(document, session=session)
    except DuplicateKeyError:
        raise ResourceConflictError("User already exists")


async def generate_handle(collection, given_name: str, family_name: str) -> str:
    """Create handle for new B2C users in Virtool using values from ID token and random
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


async def validate_credentials(mongo: "Mongo", user_id: str, password: str) -> bool:
    """Check if the ``user_id`` and ``password`` are valid.

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
        password,
        document["salt"],
        document["password"],
    ):
        return True

    return False


async def extend_user(mongo: Mongo, user: Document) -> Document:
    user_data = base_processor(
        await mongo.users.find_one(user["id"], ATTACH_PROJECTION),
    )

    return {
        **user,
        **user_data,
    }
