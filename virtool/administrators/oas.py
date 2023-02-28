from typing import Optional
from pydantic import BaseModel, Field, constr, root_validator, validator

from virtool_core.models.roles import AdministratorRole


class CreateAdministratorRequest(BaseModel):
    """
    Used when adding a user as an administrator
    """

    user_id: constr(min_length=1) = Field(description="the user id")

    role: Optional[AdministratorRole] = Field(
        default=AdministratorRole.BASE,
        description="the administrator role for the user",
    )

    @validator("role")
    def return_base_if_none(
        cls, role: Optional[AdministratorRole]
    ) -> AdministratorRole:
        if role is None:
            return AdministratorRole.BASE

        return role

    class Config:
        schema_extra = {"example": {"user_id": "foo", "role": "users"}}


class UpdateAdministratorRequest(BaseModel):
    """
    Used when updating the role for an administrator
    """

    role: AdministratorRole = Field(
        description="the administrator role for the user",
    )

    class Config:
        schema_extra = {"example": {"role": "full"}}


class ListAdministratorResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "administrator": False,
                        "handle": "leeashley",
                        "id": "bf1b993c",
                        "role": "base",
                    },
                    {
                        "administrator": False,
                        "handle": "zclark",
                        "id": "fb085f7f",
                        "role": "full",
                    },
                ],
                "available_roles": [
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
                ],
            }
        }


class GetAdministratorResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "administrator": False,
                "handle": "leeashley",
                "id": "bf1b993c",
                "role": "base",
                "available_roles": [
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
                ],
            }
        }


class CreateAdministratorResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "administrator": False,
                "handle": "foo",
                "id": "foo",
                "role": "users",
                "available_roles": [
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
                ],
            }
        }


class UpdateAdministratorResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "administrator": True,
                "handle": "foo",
                "id": "foo",
                "role": "full",
                "available_roles": [
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
                ],
            }
        }
