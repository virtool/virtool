from datetime import datetime
from typing import List, Union, Optional

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.roles import (
    SpaceRoleType,
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


class SpaceMember(UserNested):
    role: SpaceRole
    label: Optional[SpaceLabelRole]
    project: Optional[SpaceProjectRole]
    reference: Optional[SpaceReferenceRole]
    sample: Optional[SpaceSampleRole]
    subtraction: Optional[SpaceSubtractionRole]
    upload: Optional[SpaceUploadRole]


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


class SpaceSearchResult(BaseModel):
    items: List[SpaceMinimal]
    available_roles: List[dict]


ENUM_LIST = [
    SpaceRole,
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
]

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for enum in ENUM_LIST
    for role in document_enum(enum)
]


async def remove_user_roles(
    authorization_client: AuthorizationClient,
    user_id: Union[str, int],
    space_id: int,
    enum_list: List[SpaceRoleType],
):

    for enum_type in enum_list:
        for role in enum_type:
            await authorization_client.remove(
                UserRoleAssignment(user_id, space_id, enum_type(role))
            )


def format_user(user: dict, role_list: List):
    user = {
        **user,
        "label": None,
        "project": None,
        "reference": None,
        "sample": None,
        "subtraction": None,
        "upload": None,
    }

    for role in role_list:
        if role in iter(SpaceRole):
            user["role"] = SpaceRole(role)

        if role in iter(SpaceLabelRole):
            user["label"] = SpaceLabelRole(role)

        if role in iter(SpaceProjectRole):
            user["project"] = SpaceProjectRole(role)

        if role in iter(SpaceReferenceRole):
            user["reference"] = SpaceReferenceRole(role)

        if role in iter(SpaceSampleRole):
            user["sample"] = SpaceSampleRole(role)

        if role in iter(SpaceSubtractionRole):
            user["subtraction"] = SpaceSubtractionRole(role)

        if role in iter(SpaceUploadRole):
            user["upload"] = SpaceUploadRole(role)

    return SpaceMember(**user)
