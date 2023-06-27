import asyncio
from enum import EnumMeta
from logging import getLogger
from typing import List, Union

from virtool_core.models.roles import (
    SpaceRole,
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)
from virtool_core.models.spaces import SpaceMember

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import UserRoleAssignment
from virtool.mongo.core import Mongo

logger = getLogger(__name__)


async def remove_user_roles(
    authorization_client: AuthorizationClient,
    user_id: Union[str, int],
    space_id: int,
    enums: List[EnumMeta],
):

    await asyncio.gather(
        *[
            authorization_client.remove(
                UserRoleAssignment(user_id, space_id, enum_type(role))
            )
            for enum_type in enums
            for role in enum_type
        ]
    )


def format_user(user: dict, role_list: List):
    user = {
        **user,
        "label_role": None,
        "project_role": None,
        "reference_role": None,
        "sample_role": None,
        "subtraction_role": None,
        "upload_role": None,
    }

    for role in role_list:
        if role in iter(SpaceRole):
            user["role"] = SpaceRole(role)

        if role in iter(SpaceLabelRole):
            user["label_role"] = SpaceLabelRole(role)

        if role in iter(SpaceProjectRole):
            user["project_role"] = SpaceProjectRole(role)

        if role in iter(SpaceReferenceRole):
            user["reference_role"] = SpaceReferenceRole(role)

        if role in iter(SpaceSampleRole):
            user["sample_role"] = SpaceSampleRole(role)

        if role in iter(SpaceSubtractionRole):
            user["subtraction_role"] = SpaceSubtractionRole(role)

        if role in iter(SpaceUploadRole):
            user["upload_role"] = SpaceUploadRole(role)

    return SpaceMember(**user)


async def format_users(
    authorization_client: AuthorizationClient, mongo: Mongo, space_id: int
) -> List[SpaceMember]:

    member_ids = await authorization_client.list_space_users(space_id)

    users = await mongo.users.find(
        {"_id": {"$in": [member[0] for member in member_ids]}}
    ).to_list(None)

    if len(users) != len(member_ids):
        logger.warning("Missing users.")

    member_ids = {member[0]: member[1] for member in member_ids}

    return [format_user(user, member_ids[user["_id"]]) for user in users]
