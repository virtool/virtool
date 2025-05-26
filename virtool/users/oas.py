from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from virtool.api.model import RequestModel


class CreateFirstUserRequest(BaseModel):
    """A request validation model for creating the first user."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "handle": "admin",
                "password": "password",
            },
        },
        use_attribute_docstrings=True,
    )

    handle: Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
    """A unique handle for the user."""

    password: Annotated[str, StringConstraints(min_length=1)]
    """The user's password."""


class CreateUserRequest(CreateFirstUserRequest):
    """A request validation model for creating a user."""

    force_reset: bool = True
    """Force a password reset next time the user logs in."""


class UserUpdateRequest(RequestModel):
    """A validation model for a user update request."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "active": True,
                "force_reset": True,
                "groups": [1, 2],
                "password": "password",
                "primary_group": 1,
            },
        }
    )

    active: bool = None
    """Whether the user account is activated or not."""

    force_reset: bool = None
    """Force a password reset next time the user logs in."""

    groups: list[int | str] = None
    """The groups the user belongs to."""

    password: str = None
    """The new password."""

    primary_group: int = None
    """The ID of the user's primary group."""


class PermissionsResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                "create_ref",
                "create_sample",
            ],
        },
    )


class PermissionResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": True})
