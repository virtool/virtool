from typing import List, Optional

from pydantic import BaseModel, constr, Field


class CreateFirstUserSchema(BaseModel):
    """
    User fields for adding the first user to a user database.
    """

    handle: constr(strip_whitespace=True, min_length=1) = Field(
        description="a unique handle for the user"
    )
    password: constr(min_length=1) = Field(description="a unique password for the user")


class CreateUserSchema(CreateFirstUserSchema):
    """
    User fields for creating a new user.
    """

    force_reset = Field(
        default=True, description="force password reset on login if true"
    )


class UpdateUserSchema(BaseModel):
    administrator: Optional[bool] = Field(
        description="set the user’s administrator status"
    )
    force_reset: Optional[bool] = Field(
        description="force a password reset next time the user logs in"
    )
    groups: Optional[List[str]] = Field(
        description="the ids of the groups the user belongs to"
    )
    password: Optional[str] = Field(description="the new password")
    primary_group: Optional[str] = Field(
        description="the users primary group used for sample rights"
    )
