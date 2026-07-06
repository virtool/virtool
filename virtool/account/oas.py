from pydantic import BaseModel, Field, constr, root_validator, validator

from virtool.account.models import APIKey, check_email
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import QuickAnalyzeWorkflow
from virtool.models.validators import prevent_none


class UpdateAccountRequest(BaseModel):
    """Fields for updating a user account."""

    email: constr(strip_whitespace=True) | None = Field(description="an email address")
    old_password: str | None = Field(description="the old password for verification")
    password: str | None = Field(description="the new password")

    @root_validator
    def check_password(cls, values: dict):
        """Checks if old_password has also been input if a new password
        is provided.
        """
        old_password, password = values.get("old_password"), values.get("password")

        if password:
            if not old_password:
                raise ValueError(
                    "The old password needs to be given in order for the password to be changed"
                )
        elif old_password:
            raise ValueError(
                "The new password needs to be given in order for the password to be changed"
            )

        return values

    _prevent_none = prevent_none("*")
    _email_validator = validator("email", allow_reuse=True)(check_email)

    class Config:
        schema_extra = {
            "example": {
                "email": "dev@virtool.ca",
                "password": "foo_bar_1",
                "old_password": "hello_world",
            }
        }


class UpdateSettingsRequest(BaseModel):
    """Fields for updating a user account's settings."""

    quick_analyze_workflow: QuickAnalyzeWorkflow | None = Field(
        description="workflow to use for quick analysis"
    )
    show_ids: bool | None = Field(
        description="show document ids in client where possible"
    )
    show_versions: bool | None = Field(
        description="show document versions in client where possible"
    )
    skip_quick_analyze_dialog: bool | None = Field(
        description="don’t show the quick analysis dialog"
    )

    class Config:
        schema_extra = {"example": {"show_ids": False}}

    _prevent_none = prevent_none("*")


class CreateKeyRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="a non-unique name for the API key"
    )
    permissions: PermissionsUpdate | None = Field(
        default=PermissionsUpdate(),
        description="an object describing the permissions the new key will have. "
        "Any unset permissions will default to false",
    )

    class Config:
        schema_extra = {
            "example": {"name": "Foobar", "permissions": {"create_sample": True}}
        }

    _prevent_none = prevent_none("permissions")


class CreateAPIKeyResponse(APIKey):
    key: str

    class Config:
        schema_extra = {
            "example": {
                "created_at": "2015-10-06T20:00:00Z",
                "groups": [],
                "id": 42,
                "key": "raw_key",
                "name": "Foobar",
                "permissions": {
                    "cancel_job": False,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": False,
                    "upload_file": False,
                },
            }
        }


class UpdateKeyRequest(BaseModel):
    permissions: PermissionsUpdate | None = Field(
        description="a permission update comprising an object keyed by permissions "
        "with boolean values"
    )

    class Config:
        schema_extra = {"example": {"permissions": {"modify_subtraction": True}}}

    _prevent_none = prevent_none("*")
