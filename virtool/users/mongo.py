"""Utilities for working with users in the database."""

import virtool.utils
from virtool.mongo.core import Mongo
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.utils import (
    check_legacy_password,
    check_password,
)
from virtool.utils import base_processor


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
