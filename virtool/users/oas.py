from pydantic import BaseModel, constr, Field
from virtool_core.models.validators import prevent_none


class CreateFirstUserRequest(BaseModel):
    """
    User fields for adding the first user to a user database.
    """

    handle: constr(strip_whitespace=True, min_length=1) = Field(
        description="The unique handle for the user."
    )

    password: constr(min_length=1) = Field(description="The password for the user.")


class CreateUserRequest(CreateFirstUserRequest):
    """
    User fields for creating a new user.
    """

    force_reset: bool = Field(
        default=True, description="Forces a password reset next time the user logs in"
    )


class UpdateUserRequest(BaseModel):
    active: bool | None = Field(description="deactivate a user")

    administrator: bool | None = Field(
        description="The user can perform administrative tasks and access all data"
    )

    groups: list[int | str] | None = Field(
        description="Sets the IDs of groups the user belongs to"
    )

    force_reset: bool | None = Field(
        description="Forces a password reset next time the user logs in"
    )

    password: str | None = Field(description="the new password")

    primary_group: int | None = Field(
        description="Sets the ID of the user's primary group"
    )

    _prevent_none = prevent_none("administrator", "force_reset", "groups", "password")


class PermissionsResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                "create_ref",
                "create_sample",
            ]
        }


class PermissionResponse(BaseModel):
    class Config:
        schema_extra = {"example": True}
