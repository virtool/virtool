from typing import Optional
from pydantic import BaseModel, Field, constr
from virtool_core.models.group import Group, GroupMinimal


class EditPermissionsSchema(BaseModel):
    """
    Possible permissions that will be updated for a user and group.
    """

    cancel_job: Optional[bool] = None
    create_ref: Optional[bool] = None
    create_sample: Optional[bool] = None
    modify_hmm: Optional[bool] = None
    modify_subtraction: Optional[bool] = None
    remove_file: Optional[bool] = None
    remove_job: Optional[bool] = None
    upload_file: Optional[bool] = None


class CreateGroupSchema(BaseModel):
    """
    A schema for requests to create groups.
    """

    group_id: constr(strip_whitespace=True, to_lower=True, min_length=1) = Field(
        description="a unique id for the group"
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
