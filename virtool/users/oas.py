from pydantic import BaseModel, constr, Field


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

    force_reset = Field(
        default=True, description="Forces a password reset next time the user logs in"
    )


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
