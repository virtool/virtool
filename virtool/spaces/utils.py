import asyncio
from enum import EnumMeta

from structlog import get_logger
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

logger = get_logger("spaces")


async def remove_user_roles(
    authorization_client: AuthorizationClient,
    user_id: str | int,
    space_id: int,
    enums: list[EnumMeta],
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


def format_space_user(user: dict, role_list: list) -> SpaceMember:
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


async def format_space_users(
    authorization_client: AuthorizationClient, mongo: Mongo, space_id: int
) -> list[SpaceMember]:
    member_ids = await authorization_client.list_space_users(space_id)

    users = await mongo.users.find(
        {"_id": {"$in": [member[0] for member in member_ids]}}
    ).to_list(None)

    if len(users) != len(member_ids):
        mongo_member_ids = {member[0] for member in member_ids}
        openfga_member_ids = {user["_id"] for user in users}

        logger.warning(
            "Mongo-OpenFGA space member mismatch",
            mongo_extras=(mongo_member_ids - openfga_member_ids),
            openfga_extras=(openfga_member_ids - mongo_member_ids),
        )

    member_id_map = {member[0]: member[1] for member in member_ids}

    return [format_space_user(user, member_id_map[user["_id"]]) for user in users]
