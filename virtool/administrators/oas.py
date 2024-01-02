from typing import Optional

from pydantic import BaseModel, Field
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.validators import prevent_none


class RunActionRequest(BaseModel):
    """
    Used when running an action on a task
    """

    name: str = Field(description="the action to run")

    class Config:
        schema_extra = {"example": {"name": "relist_jobs"}}


class UpdateAdministratorRoleRequest(BaseModel):
    """
    Used when adding a user as an administrator
    """

    role: Optional[AdministratorRole] = Field(
        description="the administrator role for the user",
    )

    class Config:
        schema_extra = {"example": {"user_id": "foo", "role": "users"}}


class UpdateUserRequest(BaseModel):
    active: bool | None = Field(description="deactivate a user")

    force_reset: bool | None = Field(
        description="Forces a password reset next time the user logs in"
    )

    groups: list[int | str] | None = Field(
        description="Sets the IDs of groups the user belongs to"
    )

    password: str | None = Field(description="the new password")

    primary_group: int | None = Field(
        description="Sets the ID of the user's primary group"
    )

    _prevent_none = prevent_none("active", "force_reset", "groups", "password")


class ListRolesResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {
                    "id": "full",
                    "name": "Full",
                    "description": "Manage who is an administrator and what they can do.",
                },
                {
                    "id": "settings",
                    "name": "Settings",
                    "description": "Manage instance settings and administrative messages.",
                },
                {
                    "id": "spaces",
                    "name": "Spaces",
                    "description": "Manage users in any space. Delete any space.",
                },
                {
                    "id": "users",
                    "name": "Users",
                    "description": "Create user accounts. Control activation of user accounts.",
                },
                {
                    "id": "base",
                    "name": "Base",
                    "description": "Provides ability to:\n     - Create new spaces even if the `Free Spaces` "
                    "setting is not enabled.\n     - Manage HMMs and common references.\n     - "
                    "View all running jobs.\n     - Cancel any job.\n    ",
                },
            ]
        }


class ListAdministratorResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "items": [
                    {
                        "handle": "leeashley",
                        "id": "TxWalSSn",
                        "active": True,
                        "b2c": None,
                        "b2c_display_name": None,
                        "b2c_family_name": None,
                        "b2c_given_name": None,
                        "b2c_oid": None,
                        "force_reset": False,
                        "groups": [],
                        "last_password_change": "2023-03-20T22:46:26.151000Z",
                        "permissions": {
                            "cancel_job": False,
                            "create_ref": False,
                            "create_sample": False,
                            "modify_hmm": False,
                            "modify_subtraction": False,
                            "remove_file": False,
                            "remove_job": False,
                            "upload_file": False,
                        },
                        "primary_group": None,
                        "administrator_role": "base",
                    },
                    {
                        "handle": "zclark",
                        "id": "fb085f7f",
                        "active": True,
                        "b2c": None,
                        "b2c_display_name": None,
                        "b2c_family_name": None,
                        "b2c_given_name": None,
                        "b2c_oid": None,
                        "force_reset": False,
                        "groups": [],
                        "last_password_change": "2023-03-20T22:46:26.151000Z",
                        "permissions": {
                            "cancel_job": False,
                            "create_ref": False,
                            "create_sample": False,
                            "modify_hmm": False,
                            "modify_subtraction": False,
                            "remove_file": False,
                            "remove_job": False,
                            "upload_file": False,
                        },
                        "primary_group": None,
                        "administrator_role": "full",
                    },
                ],
            }
        }


class UserResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "id": "TxWalSSn",
                "handle": "user_handle",
                "active": True,
                "b2c": None,
                "b2c_display_name": None,
                "b2c_family_name": None,
                "b2c_given_name": None,
                "b2c_oid": None,
                "force_reset": False,
                "groups": [],
                "last_password_change": "2023-03-20T22:46:26.151000Z",
                "permissions": {
                    "cancel_job": False,
                    "create_ref": False,
                    "create_sample": False,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": False,
                    "upload_file": False,
                },
                "primary_group": None,
                "administrator_role": "base",
            }
        }
