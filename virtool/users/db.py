import random
from asyncio import gather
from dataclasses import dataclass
from logging import Logger
from typing import Any, Dict, List, Optional, Union

from motor.motor_asyncio import AsyncIOMotorClientSession
from virtool_core.models.user import User

from virtool.errors import DatabaseError
from virtool.groups.db import get_merged_permissions
from virtool.mongo.transforms import AbstractTransform
from virtool.mongo.utils import (
    get_non_existent_ids,
    id_exists,
)
from virtool.types import Document
from virtool.users.utils import (
    check_legacy_password,
    check_password,
    limit_permissions,
)
from virtool.utils import base_processor

logger = Logger(__name__)

PROJECTION = [
    "_id",
    "handle",
    "administrator",
    "force_reset",
    "groups",
    "last_password_change",
    "permissions",
    "primary_group",
]

ATTACH_PROJECTION = ["administrator", "handle"]


@dataclass
class B2CUserAttributes:
    """
    Class to store ID token claims from Azure AD B2C
    """

    oid: str
    display_name: str
    given_name: str
    family_name: str


class AttachUserTransform(AbstractTransform):
    """
    Attaches more complete user data to a document with a `user.id` field.
    """

    def __init__(self, db, ignore_errors: bool = False):
        self._db = db
        self._ignore_errors = ignore_errors

    def _extract_user_id(self, document: Document) -> Optional[str]:
        try:
            user = document["user"]

            try:
                return user["id"]
            except TypeError:
                if isinstance(user, str):
                    return user

                raise
        except KeyError:
            if not self._ignore_errors:
                raise KeyError("Document needs a value at user or user.id")

        return None

    async def attach_one(self, document, prepared):
        try:
            user_data = document["user"]
        except KeyError:
            if self._ignore_errors:
                return document

            raise

        if isinstance(user_data, str):
            return {
                **document,
                "user": {
                    "id": user_data,
                    **prepared,
                },
            }

        return {
            **document,
            "user": {
                **document["user"],
                **prepared,
            },
        }

    async def attach_many(
        self, documents: List[Document], prepared: Dict[int, Any]
    ) -> List[Document]:
        return [
            await self.attach_one(document, prepared[self._extract_user_id(document)])
            for document in documents
        ]

    async def prepare_one(self, document):
        user_id = self._extract_user_id(document)
        user_data = base_processor(
            await self._db.users.find_one(user_id, ATTACH_PROJECTION)
        )

        if not user_data:
            raise KeyError(f"Document contains non-existent user: {user_id}.")

        return user_data

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        user_ids = list({self._extract_user_id(document) for document in documents})

        return {
            document["_id"]: base_processor(document)
            async for document in self._db.users.find(
                {"_id": {"$in": user_ids}}, ATTACH_PROJECTION
            )
        }


async def extend_user(db, user: Dict[str, Any]) -> Dict[str, Any]:
    user_id = user["id"]

    user_data = base_processor(await db.users.find_one(user_id, ATTACH_PROJECTION))

    extended = {
        **user,
        **user_data,
    }

    return extended


async def compose_groups_update(db, groups: Optional[list]) -> dict:
    """
    Compose a update dict for the updating the list of groups a user is a member of.

    :param db: the application database client
    :param groups: the groups to include in the user update

    :return: an update
    """
    if groups is None:
        return {}

    non_existent_groups = await get_non_existent_ids(db.groups, groups)

    if non_existent_groups:
        raise DatabaseError("Non-existent groups: " + ", ".join(non_existent_groups))

    update = {"groups": groups, "permissions": await get_merged_permissions(db, groups)}

    return update


async def compose_primary_group_update(
    db, user_id: Optional[str], primary_group: Optional[str]
) -> dict:
    """
    Compose an update dict for changing a user's `primary_group`.

    :param db: the application database client
    :param user_id: the id of the user being updated
    :param primary_group: the primary group to set for the user
    :return: an update

    """
    if primary_group is None:
        return {}

    if primary_group != "none":
        if not await id_exists(db.groups, primary_group):
            raise DatabaseError("Non-existent group: " + primary_group)

        if not await is_member_of_group(db, user_id, primary_group):
            raise DatabaseError("User is not member of group")

    return {"primary_group": primary_group}


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


async def is_member_of_group(db, user_id: str, group_id: str) -> bool:
    return bool(
        await db.users.count_documents({"_id": user_id, "groups": group_id}, limit=1)
    )


async def validate_credentials(db, user_id: str, password: str) -> bool:
    """
    Check if the ``user_id`` and ``password`` are valid.

    Returns ``True`` if the username exists and the password is correct. Returns
    ``False`` if the username does not exist or the password is incorrect.

    :param db: a database client
    :param user_id: the username to check.
    :param password: the password to check.
    :return: validation success

    """
    document = await db.users.find_one(user_id, ["password", "salt"])

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


async def update_sessions_and_keys(
    db,
    user_id: str,
    administrator: bool,
    groups: list,
    permissions: dict,
    session: Optional[AsyncIOMotorClientSession] = None,
):
    """

    :param db: a database client
    :param user_id: the id of the user to update keys and session for
    :param administrator: the administrator flag for the user
    :param groups: an updated list of groups
    :param permissions: an updated set of permissions derived from the updated groups
    :param session: an option Motor session to use

    """
    query = {"user.id": user_id}

    await gather(
        *[
            db.keys.update_one(
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
            async for document in db.keys.find(query, ["permissions"], session=session)
        ]
    )

    await db.sessions.update_many(
        query,
        {
            "$set": {
                "administrator": administrator,
                "groups": groups,
                "permissions": permissions,
            }
        },
        session=session,
    )


async def fetch_complete_user(mongo, user_id: str) -> Optional[User]:
    async for user in mongo.users.aggregate(
        [
            {"$match": {"_id": user_id}},
            {
                "$lookup": {
                    "from": "groups",
                    "localField": "groups",
                    "foreignField": "_id",
                    "as": "groups",
                }
            },
            {
                "$lookup": {
                    "from": "groups",
                    "localField": "primary_group",
                    "foreignField": "_id",
                    "as": "primary_group",
                }
            },
        ]
    ):
        return User(
            **{
                **user,
                "primary_group": user["primary_group"][0]
                if user["primary_group"]
                else None,
            }
        )

    return None
