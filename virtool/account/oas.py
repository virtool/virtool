from __future__ import annotations

from pydantic import BaseModel, Field, constr, root_validator, validator

from virtool.account.models import Account, APIKey, check_email
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import QuickAnalyzeWorkflow
from virtool.models.validators import prevent_none


class UpdateAccountRequest(BaseModel):
    """Fields for updating a user account."""

    email: constr(strip_whitespace=True) | None = Field(description="an email address")
    old_password: str | None = Field(description="the old password for verification")
    password: str | None = Field(description="the new password")

    @root_validator
    def check_password(cls, values: str | constr):
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

    _email_validator = validator("email", allow_reuse=True)(check_email)
    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "email": "dev@virtool.ca",
                "password": "foo_bar_1",
                "old_password": "hello_world",
            }
        }


class UpdateAccountResponse(Account):
    class Config:
        schema_extra = {
            "example": {
                "administrator_role": None,
                "email": "dev@virtool.ca",
                "groups": [],
                "handle": "bob",
                "id": "test",
                "last_password_change": "2015-10-06T20:00:00Z",
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
                "primary_group": {"id": 6, "name": "Technicians"},
                "settings": {
                    "quick_analyze_workflow": "pathoscope_bowtie",
                    "show_ids": True,
                    "show_versions": True,
                    "skip_quick_analyze_dialog": True,
                },
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


class CreateKeysRequest(BaseModel):
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
                "id": "foobar_0",
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


class APIKeyResponse(APIKey):
    class Config:
        schema_extra = {
            "example": {
                "created_at": "2015-10-06T20:00:00Z",
                "groups": [],
                "id": "foobar_0",
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


class CreateLoginRequest(BaseModel):
    username: constr(min_length=1) = Field(description="account username")
    password: constr(min_length=1) = Field(description="account password")
    remember: bool | None = Field(
        default=False,
        description="value determining whether the session will last for 1 month or "
        "1 hour",
    )

    class Config:
        schema_extra = {
            "example": {
                "username": "foobar",
                "password": "p@ssword123",
                "remember": False,
            }
        }

    _prevent_none = prevent_none("*")


class LoginResponse(BaseModel):
    class Config:
        schema_extra = {"example": {"reset": False}}


class ResetPasswordRequest(BaseModel):
    password: str
    reset_code: str

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "password": "p@ssword123",
                "reset_code": "4bcda8b3bcaf5f84cc6e26a3d23a6179f29d356e43c9ced1b6de0d8f4946555e",
            }
        }


class AccountResetPasswordResponse(BaseModel):
    class Config:
        schema_extra = {"example": {"login": False, "reset": False}}


class ListAPIKeysResponse(APIKey):
    class Config:
        schema_extra = {
            "example": [
                {
                    "created_at": "2015-10-06T20:00:00Z",
                    "groups": [],
                    "id": "baz_1",
                    "name": "Baz",
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
            ]
        }
