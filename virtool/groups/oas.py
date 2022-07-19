from typing import Optional
from pydantic import BaseModel, Field, constr
from virtool_core.models.group import Group


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
    Group id for creating a new Group.
    """
    group_id: constr(strip_whitespace=True, to_lower=True, min_length=1) = Field(
        description="a unique id and display name for the group")

    class Config:
        schema_extra = {
            "example": {
                "group_id": "research"
            }
        }


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
                    "upload_file": True
                },
                "id": "research"

            }

        }


class GetGroupResponse(Group):
    class Config:
        schema_extra = {
            "example": [
                {
                    "permissions": {
                        "cancel_job": True,
                        "create_ref": False,
                        "create_sample": True,
                        "modify_hmm": False,
                        "modify_subtraction": False,
                        "remove_file": False,
                        "remove_job": True,
                        "upload_file": True
                    },
                    "id": "technicians"
                }
            ]
        }


class EditGroupSchema(BaseModel):
    """
    Used when updating permissions.
    """
    permissions: EditPermissionsSchema = Field(
        description="a permission update comprising an object keyed by permissions "
                    "with boolean values", default={})

    class Config:
        schema_extra = {
            "example": {
                "permissions": {
                    "create_ref": True
                }

            }
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
                    "upload_file": True
                },
                "id": "technicians"
            }
        }
