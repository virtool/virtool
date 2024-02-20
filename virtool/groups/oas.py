"""
Request and response models use to validate requests and autogenerate the OpenAPI
specification.
"""

from pydantic import BaseModel, Field, constr
from virtool_core.models.group import Group


class PermissionsUpdate(BaseModel):
    """
    Possible permissions that will be updated for a user and group.
    """

    cancel_job: bool | None
    create_ref: bool | None
    create_sample: bool | None
    modify_hmm: bool | None
    modify_subtraction: bool | None
    remove_file: bool | None
    remove_job: bool | None
    upload_file: bool | None


class CreateGroupRequest(BaseModel):
    """
    A schema for requests to create groups.
    """

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="a name for the group"
    )

    class Config:
        schema_extra = {"example": {"name": "Research"}}


class CreateGroupResponse(Group):
    class Config:
        schema_extra = {
            "example": {
                "permissions": {
                    "cancel_job": True,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": True,
                    "upload_file": True,
                },
                "id": "research",
                "name": "research",
                "users": [],
            }
        }


class UpdateGroupRequest(BaseModel):
    """
    Used when updating permissions and/or group `name`.
    """

    name: constr(min_length=1) | None = Field(description="a name for the group")

    permissions: PermissionsUpdate | None = Field(
        description="a permission update comprising an object keyed by permissions with boolean values"
    )

    class Config:
        schema_extra = {
            "example": {"permissions": {"create_ref": True}, "name": "Managers" ""}
        }


class GroupResponse(Group):
    class Config:
        schema_extra = {
            "example": {
                "permissions": {
                    "cancel_job": True,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": True,
                    "upload_file": True,
                },
                "id": "technicians",
                "name": "technicians",
                "users": [
                    {
                        "administrator": False,
                        "b2c": None,
                        "b2c_display_name": None,
                        "b2c_family_name": None,
                        "b2c_given_name": None,
                        "b2c_oid": None,
                        "handle": "leeashley",
                        "id": "7CtBo2yG",
                    },
                ],
            }
        }
