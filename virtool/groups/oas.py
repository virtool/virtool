from pydantic import Field, constr

from virtool.models.base import BaseModel


class PermissionsUpdate(BaseModel):
    """Possible permissions that will be updated for a user and group."""

    cancel_job: bool | None
    create_ref: bool | None
    create_sample: bool | None
    modify_hmm: bool | None
    modify_subtraction: bool | None
    remove_file: bool | None
    remove_job: bool | None
    upload_file: bool | None


class CreateGroupRequest(BaseModel):
    """A schema for requests to create groups."""

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="a name for the group",
    )

    class Config:
        schema_extra = {"example": {"name": "Research"}}


class UpdateGroupRequest(BaseModel):
    """Used when updating permissions and/or group `name`."""

    name: constr(min_length=1) | None = Field(description="a name for the group")

    permissions: PermissionsUpdate | None = Field(
        description="a permission update comprising an object keyed by permissions with boolean values",
    )

    class Config:
        schema_extra = {
            "example": {"permissions": {"create_ref": True}, "name": "Managers"},
        }
