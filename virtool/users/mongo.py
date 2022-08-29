from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.errors import DuplicateKeyError

import virtool.utils
from virtool.data.errors import ResourceConflictError
from virtool.types import Document
from virtool.users.db import B2CUserAttributes
from virtool.users.utils import generate_base_permissions, hash_password


async def create_user(
    mongo,
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
        "permissions": generate_base_permissions(),
        "primary_group": None,
        "force_reset": force_reset,
        "last_password_change": virtool.utils.timestamp(),
        "invalidate_sessions": False,
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
