from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    constr,
    field_validator,
    model_validator,
)
from virtool_core.models.account import Account, AccountSettings, APIKey, check_email
from virtool_core.models.enums import QuickAnalyzeWorkflow

from virtool.groups.oas import PermissionsUpdate
from virtool.validation import MaybeUnset, Unset, UnsetType


class AccountUpdateRequest(BaseModel):
    """Fields for updating a user account."""

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )

    email: constr(strip_whitespace=True) | UnsetType = Unset
    """An email address."""

    old_password: str | UnsetType = Unset
    """The old password for verification."""

    password: str | UnsetType = Unset
    """The new password."""

    @field_validator("email", mode="after")
    @classmethod
    def check_email(cls: type, email: str) -> str:
        """Check if the email is valid."""
        return check_email(email)

    @model_validator(mode="after")
    def check_password(self) -> "AccountUpdateRequest":
        """Check if old_password has also been input if a new password is provided."""
        if self.password and not self.old_password:
            msg = (
                "The old password needs to be given in order for the password to be "
                "changed."
            )
            raise ValueError(msg)

        if self.old_password and not self.password:
            msg = (
                "A new password needs to be provided in order for the password to be "
                "changed."
            )
            raise ValueError(msg)

        return self


class AccountUpdateResponse(Account):
    """A response model for a user account update."""

    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
    )


class AccountSettingsUpdateRequest(BaseModel):
    """Fields for updating a user account's settings."""

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )

    quick_analyze_workflow: MaybeUnset[QuickAnalyzeWorkflow]
    """The workflow to use for quick analysis."""

    show_ids: MaybeUnset[bool]
    """Whether to show resource IDs explicitly in the UI."""

    show_versions: MaybeUnset[bool]
    """Show document versions in client where possible"""

    skip_quick_analyze_dialog: MaybeUnset[bool]
    """Whether to skip the quick analysis dialog."""


class CreateKeyRequest(BaseModel):
    """A validation model for a request to create a new API key."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "Foobar", "permissions": {"create_sample": True}},
        },
        use_attribute_docstrings=True,
    )

    name: Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
    """A non-unique name for the API key."""

    permissions: Annotated[PermissionsUpdate, Field(default_factory=PermissionsUpdate)]
    """A permission update comprising an object keyed by permissions with boolean
    values."""


class CreateKeyResponse(APIKey):
    """A response model for a newly created API key."""

    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
        use_attribute_docstrings=True,
    )

    key: str
    """The private API key.

    This response is the only place the unhashed key is returned.
    """


class UpdateKeyRequest(BaseModel):
    """A validation model for a request to update an existing API key."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"permissions": {"modify_subtraction": True}},
        },
        use_attribute_docstrings=True,
    )

    permissions: PermissionsUpdate | UnsetType = Unset
    """A permission update comprising an object keyed by permissions with boolean
    values."""


class APIKeyResponse(APIKey):
    """A response model for an API key."""

    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
    )


class CreateLoginRequest(BaseModel):
    """A validation model for a login request."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "foobar",
                "password": "p@ssword123",
                "remember": False,
            },
        },
        use_attribute_docstrings=True,
    )

    username: Annotated[str, StringConstraints(min_length=1)]
    """The username."""

    password: Annotated[str, StringConstraints(min_length=1)]
    """The password."""

    remember: bool = False
    """Whether the session will last for 1 month instead of the 1 hour default."""


class CreateLoginResponse(BaseModel):
    """A response model for a login request."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"reset": False}},
        use_attribute_docstrings=True,
    )

    reset: bool
    """Whether the user needs to reset their password."""


class ResetPasswordRequest(BaseModel):
    """A validation model for a password reset request."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "password": "p@ssword123",
                "reset_code": "4bcda8b3bcaf5f84cc6e26a3d23a6179f29d356e43c9ced1b6de0b1",
            },
        },
        use_attribute_docstrings=True,
    )

    password: str
    """The new password."""

    reset_code: str
    """The reset code required to reset the password."""


class ResetPasswordResponse(BaseModel):
    """A response model for a password reset request."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"login": False, "reset": False}},
        use_attribute_docstrings=True,
    )

    login: bool
    """Whether the user is logged in."""

    reset: bool
    """Whether the user needs to reset their password."""


class AccountResponse(Account):
    """A response model for a user account."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "administrator_role": None,
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
                "primary_group": {
                    "id": 5,
                    "name": "Technician",
                },
                "settings": {
                    "quick_analyze_workflow": "pathoscope_bowtie",
                    "show_ids": True,
                    "show_versions": True,
                    "skip_quick_analyze_dialog": True,
                },
            },
        },
    )


class AccountSettingsResponse(AccountSettings):
    """A response model for a user account's settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "quick_analyze_workflow": "pathoscope_bowtie",
                "show_ids": True,
                "skip_quick_analyze_dialog": True,
                "show_versions": True,
            },
        },
    )


class ListAPIKeysResponse(APIKey):
    """A response model for an account's API key listing."""

    model_config = ConfigDict(
        json_schema_extra={
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
                },
            ],
        },
    )
