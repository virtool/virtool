from pydantic import BaseModel, ConfigDict
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User

from virtool.api.model import RequestModel


class RunActionRequest(RequestModel):
    """Used when running an action on a task."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "relist_jobs"},
        }
    )

    name: str
    """The name of the action to run."""


class AdministratorRoleUpdateRequest(RequestModel):
    """A validation model for a request to update an administrator's role."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"user_id": "foo", "role": "users"}},
    )

    role: AdministratorRole | None = None
    """The role to assign to the user."""


class UserUpdateRequest(RequestModel):
    """A validation model for a user update request."""

    active: bool = None
    """The activation status of the user."""

    force_reset: bool = None
    """Force the user to reset their password on next login."""

    groups: list[int | str] = None
    """The groups the user belongs to."""

    password: str = None
    """A new password for the user."""

    primary_group: int = None
    """The user's primary group."""


class ListRolesResponse(BaseModel):
    """A response model for a list of administrator roles."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {
                    "id": "full",
                    "name": "Full",
                    "description": (
                        "Manage who is an administrator and what they can do."
                    ),
                },
                {
                    "id": "settings",
                    "name": "Settings",
                    "description": (
                        "Manage instance settings and administrative messages."
                    ),
                },
                {
                    "id": "spaces",
                    "name": "Spaces",
                    "description": "Manage users in any space. Delete any space.",
                },
                {
                    "id": "users",
                    "name": "Users",
                    "description": (
                        "Create user accounts. Control activation of user accounts."
                    ),
                },
                {
                    "id": "base",
                    "name": "Base",
                    "description": (
                        "Provides ability to:\n     - Create new spaces even if the "
                        "`Free Spaces` setting is not enabled.\n     - Manage HMMs and"
                        "common references.\n     - View all running jobs.\n     "
                        "- Cancel any job.\n    "
                    ),
                },
            ],
        },
    )


class ListAdministratorResponse(BaseModel):
    """A response model a list of administrators."""

    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
    )


class UserResponse(User):
    """A response model for a user."""

    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
    )
