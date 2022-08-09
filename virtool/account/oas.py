from typing import Union, Optional

from email_validator import validate_email, EmailSyntaxError
from pydantic import BaseModel, constr, Field, root_validator, validator
from virtool_core.models.enums import QuickAnalyzeWorkflow
from virtool_core.models.account import Account, AccountSettings, check_email
from virtool.groups.oas import EditPermissionsSchema


class EditAccountSchema(BaseModel):
    """
    Fields for editing a user account.
    """

    email: Optional[constr(strip_whitespace=True)] = Field(
        description="an email address"
    )
    old_password: Optional[str] = Field(description="the old password for verification")
    password: Optional[str] = Field(description="the new password")

    class Config:
        schema_extra = {
            "example": {
                "email": "dev@virtool.ca",
                "password": "foo_bar_1",
                "old_password": "hello_world",
            }
        }

    @root_validator
    def check_password(cls, values: Union[str, constr]):
        """
        Checks if old_password has also been input if a new password
        is provided.
        """
        old_password, password = values.get("old_password"), values.get("password")

        if password:
            if not old_password:
                raise ValueError(
                    "The old password needs to be given in order for the password to be changed"
                )
        else:
            if old_password:
                raise ValueError(
                    "The new password needs to be given in order for the password to be changed"
                )

        return values

    @validator("email")
    def check_email(cls, email: Optional[str]) -> str:
        """
        Checks if the given email is valid.
        """
        if email:
            try:
                validate_email(email)
            except EmailSyntaxError:
                raise ValueError("The format of the email is invalid")

        return email


class EditAccountResponse(Account):
    class Config:
        schema_extra = {
            "example": {
                "administrator": False,
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
                "primary_group": "technician",
                "settings": {
                    "quick_analyze_workflow": "pathoscope_bowtie",
                    "show_ids": True,
                    "show_versions": True,
                    "skip_quick_analyze_dialog": True,
                },
                "email": "dev@virtool.ca",
            }
        }


class EditSettingsSchema(BaseModel):
    """
    Fields for editing a user account's settings.
    """

    show_ids: Optional[bool] = Field(
        description="show document ids in client where possible"
    )
    skip_quick_analyze_dialog: Optional[bool] = Field(
        description="don’t show the quick analysis dialog"
    )
    quick_analyze_workflow: Optional[QuickAnalyzeWorkflow] = Field(
        description="workflow to use for quick analysis"
    )
    show_versions: Optional[bool] = Field(
        description="show document versions in client where possible"
    )

    class Config:
        schema_extra = {
            "example": {
                "show_ids": False,
            }
        }


class CreateKeysSchema(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="a non-unique name for the API key"
    )
    permissions: EditPermissionsSchema = Field(
        default={},
        description="an object describing the permissions the new key will have. "
        "Any unset permissions will default to false",
    )

    class Config:
        schema_extra = {
            "example": {"name": "Foobar", "permissions": {"create_sample": True}}
        }


class CreateAPIKeyResponse(BaseModel):
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


class EditKeySchema(BaseModel):
    permissions: EditPermissionsSchema = Field(
        description="a permission update comprising an object keyed by permissions "
        "with boolean values",
        default={},
    )

    class Config:
        schema_extra = {"example": {"permissions": {"modify_subtraction": True}}}


class APIKeyResponse(BaseModel):
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


class CreateLoginSchema(BaseModel):
    username: constr(min_length=1) = Field(description="account username")
    password: constr(min_length=1) = Field(description="account password")
    remember: bool = Field(
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


class LoginResponse(BaseModel):
    class Config:
        schema_extra = {"example": {"reset": False}}


class ResetPasswordSchema(BaseModel):
    password: str
    reset_code: str

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


class AccountResponse(Account):
    class Config:
        schema_extra = {
            "example": {
                "administrator": False,
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
                "primary_group": "technician",
                "settings": {
                    "quick_analyze_workflow": "pathoscope_bowtie",
                    "show_ids": True,
                    "show_versions": True,
                    "skip_quick_analyze_dialog": True,
                },
            }
        }


class AccountSettingsResponse(AccountSettings):
    class Config:
        schema_extra = {
            "example": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie",
            }
        }


class GetAPIKeysResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {"id": "baz_1", "name": "Baz"},
            ]
        }
