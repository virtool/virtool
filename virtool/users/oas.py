from pydantic import BaseModel, Field

from virtool.models.validators import prevent_none


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
