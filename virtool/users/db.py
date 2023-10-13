"""
Database utilities for managing users.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.data.topg import compose_legacy_id_expression
from virtool.groups.pg import SQLGroup
from virtool.types import Document
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


ATTACH_PROJECTION = ["_id", "administrator", "handle"]

PROJECTION = [
    "_id",
    "handle",
    "administrator",
    "force_reset",
    "groups",
    "last_password_change",
    "primary_group",
]


@dataclass
class B2CUserAttributes:
    """
    Class to store ID token claims from Azure AD B2C
    """

    display_name: str
    family_name: str
    given_name: str
    oid: str


async def extend_user(mongo: Mongo, user: Document) -> Document:
    user_data = base_processor(
        await mongo.users.find_one(user["id"], ATTACH_PROJECTION)
    )

    return {
        **user,
        **user_data,
    }


async def compose_groups_update(
    pg: AsyncEngine, group_ids: list[int | str]
) -> dict[str, list[int | str]]:
    """
    Compose an update dict for updating the list of groups a user is a member of.

    Any legacy string ids will be converted to modern integer ids. A
    ``ResourceConflictError`` will be raised if any of the ``group_ids`` do not exist.

    :param pg: the application Postgres client
    :param group_ids: the group ids to include in update
    :return: an update
    """
    if group_ids is None:
        return {}

    if not group_ids:
        return {"groups": []}

    async with AsyncSession(pg) as session:
        expr = compose_legacy_id_expression(SQLGroup, group_ids)

        result = await session.execute(
            select(SQLGroup.id, SQLGroup.legacy_id).where(expr)
        )

        existing_group_ids = [id_ for row in result.all() for id_ in row]

    non_existent_group_ids = {
        group_id for group_id in group_ids if group_id not in existing_group_ids
    }

    if non_existent_group_ids:
        # Sort the ids so that the error message is consistent.
        repr_ids = sorted([repr(id_) for id_ in non_existent_group_ids])
        raise ResourceConflictError(f"Non-existent groups: {', '.join(repr_ids)}")

    return {"groups": group_ids}
