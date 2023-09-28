from dataclasses import dataclass
from logging import getLogger
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.types import Document
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

logger = getLogger("users")

PROJECTION = [
    "_id",
    "handle",
    "administrator",
    "force_reset",
    "groups",
    "last_password_change",
    "primary_group",
]

ATTACH_PROJECTION = ["_id", "administrator", "handle"]


@dataclass
class B2CUserAttributes:
    """
    Class to store ID token claims from Azure AD B2C
    """

    oid: str
    display_name: str
    given_name: str
    family_name: str


async def extend_user(mongo: "Mongo", user: Document) -> Document:
    user_data = base_processor(
        await mongo.users.find_one(user["id"], ATTACH_PROJECTION)
    )

    return {
        **user,
        **user_data,
    }


async def compose_groups_update(
    pg: AsyncEngine, group_ids: list[int]
) -> dict[str, list[int | str]]:
    """
    Compose an update dict for the updating the list of groups a user is a member of.

    :param pg: the application Postgres client
    :param group_ids: the group ids to include in update
    :return: an update
    """
    if group_ids is None:
        return {}

    async with AsyncSession(pg) as session:
        groups = (
            await session.execute(
                select(SQLGroup.id).filter(SQLGroup.id.in_(group_ids))
            )
        ).scalars()

        non_existent_group_ids = {
            str(group_id) for group_id in group_ids if group_id not in groups
        }

    if non_existent_group_ids:
        raise DatabaseError(f"Non-existent groups: {', '.join(non_existent_group_ids)}")

    return {"groups": group_ids}


async def compose_primary_group_update(
    mongo: "Mongo",
    pg: AsyncEngine,
    extra_group_ids: list[int],
    group_id: int | str | None,
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
                raise DatabaseError(f"Non-existent group: {group_id}")

        if group_id not in extra_group_ids and not await mongo.users.count_documents(
            {"_id": user_id, "groups": group_id}, limit=1
        ):
            raise DatabaseError("User is not member of group")

    return {"primary_group": group_id}


def lookup_nested_user_by_id(
    local_field: str = "user.id", set_as: str = "user"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up a nested user by id.

    :param local_field: user id field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "users",
                "let": {"user_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$user_id"]}}},
                    {
                        "$project": {
                            "id": "$_id",
                            "_id": False,
                            "handle": True,
                            "administrator": True,
                        }
                    },
                ],
                "as": set_as,
            }
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]
