from typing import Optional
from pydantic import BaseModel, Field, constr
from virtool_core.models.group import Group, GroupMinimal


class EditPermissionsSchema(BaseModel):
    """
    Possible permissions that will be updated for a user and group.
    """

    cancel_job: Optional[bool]
    create_ref: Optional[bool]
    create_sample: Optional[bool]
    modify_hmm: Optional[bool]
    modify_subtraction: Optional[bool]
    remove_file: Optional[bool]
    remove_job: Optional[bool]
    upload_file: Optional[bool]


class CreateGroupSchema(BaseModel):
    """
    A schema for requests to create groups.
    """

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="a name for the group", alias="group_id"
    )

    class Config:
        schema_extra = {"example": {"group_id": "research"}}


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


class GetGroupResponse(GroupMinimal):
    class Config:
        schema_extra = {
            "example": [
                {
                    "id": "technicians",
                    "name": "technicians",
                },
                {
                    "id": "sidney",
                    "name": "sidney",
                },
            ]
        }


class EditGroupSchema(BaseModel):
    """
    Used when updating permissions and/or group `name`.
    """

    permissions: EditPermissionsSchema = Field(
        description="a permission update comprising an object keyed by permissions "
        "with boolean values",
        default={},
    )

    name: Optional[constr(min_length=1)] = Field(
        description="a name for the group", default=None
    )

    class Config:
        schema_extra = {
            "example": {"permissions": {"create_ref": True}, "name": "Gobblers"}
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
