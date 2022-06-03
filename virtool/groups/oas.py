from typing import Optional
from pydantic import BaseModel, Field, constr


class EditPermissionsSchema(BaseModel):
    """
    Possible permissions that will be updated for a user and group.
    """
    cancel_job: Optional[bool] = None
    create_ref: Optional[bool] = None
    create_sample: Optional[bool] = None
    modify_hmm: Optional[bool] = None
    modify_subtraction: Optional[bool] = None
    remove_file: Optional[bool] = None
    remove_job: Optional[bool] = None
    upload_file: Optional[bool] = None


class CreateGroupSchema(BaseModel):
    """
    Group id for creating a new Group.
    """
    group_id: constr(strip_whitespace=True, to_lower=True, min_length=1) = Field(
        description="a unique id and display name for the group")


class EditGroupSchema(BaseModel):
    """
    Used when updating permissions.
    """
    permissions: EditPermissionsSchema = Field(
        description="a permission update comprising an object keyed by permissions "
                    "with boolean values", default={})
