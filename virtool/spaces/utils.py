import asyncio
from datetime import datetime
from enum import EnumMeta
from logging import getLogger
from typing import List, Union, Optional

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.roles import (
    SpaceRole,
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)
from virtool_core.models.user import UserNested
from virtool_core.utils import document_enum

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import UserRoleAssignment
from virtool.mongo.core import Mongo

logger = getLogger(__name__)


class SpaceMember(UserNested):
    role: SpaceRole
    label_role: Optional[SpaceLabelRole]
    project_role: Optional[SpaceProjectRole]
    reference_role: Optional[SpaceReferenceRole]
    sample_role: Optional[SpaceSampleRole]
    subtraction_role: Optional[SpaceSubtractionRole]
    upload_role: Optional[SpaceUploadRole]


class SpaceNested(BaseModel):
    id: int
    name: str


class SpaceMinimal(SpaceNested):
    description: str


class Space(SpaceMinimal):
    created_at: datetime
    updated_at: datetime
    created_by: str
    members: List[SpaceMember]


class MemberSearchResult(BaseModel):
    items: List[SpaceMember]
    available_roles: List[dict]


AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for enum in [
        SpaceRole,
        SpaceLabelRole,
        SpaceProjectRole,
        SpaceReferenceRole,
        SpaceSampleRole,
        SpaceSubtractionRole,
        SpaceUploadRole,
    ]
    for role in document_enum(enum)
]


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
