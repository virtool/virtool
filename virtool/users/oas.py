from pydantic import BaseModel, Field, constr

from virtool.models.validators import prevent_none


class CreateFirstUserRequest(BaseModel):
    """User fields for adding the first user to a user database."""

    handle: constr(strip_whitespace=True, min_length=1) = Field(
        description="the unique handle for the user",
    )

    password: constr(min_length=1) = Field(description="the password for the user")


class CreateUserRequest(CreateFirstUserRequest):
    """User fields for creating a new user."""

    force_reset: bool = Field(
        default=True,
        description="forces a password reset next time the user logs in",
    )


class UpdateUserRequest(BaseModel):
    """User fields for updating a user."""

    active: bool | None = Field(description="make a user active or not")

    force_reset: bool | None = Field(
        description="forces a password reset next time the user logs in",
    )

    groups: list[int | str] | None = Field(
        description="sets the IDs of groups the user belongs to",
    )

    password: str | None = Field(description="the new password")

    primary_group: int | None = Field(
        description="set the ID of the user's primary group",
    )

    _prevent_none = prevent_none("active", "force_reset", "groups", "password")


class PermissionsResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                "create_ref",
                "create_sample",
            ],
        }


class PermissionResponse(BaseModel):
    class Config:
        schema_extra = {"example": True}
