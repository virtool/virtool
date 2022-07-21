from typing import Union, Optional
from pydantic import BaseModel, constr, Field, root_validator, validator
from email_validator import validate_email, EmailSyntaxError
from virtool.users.utils import Permission
from virtool_core.models.enums import QuickAnalyzeWorkflow


def check_permissions(permissions: dict) -> dict:
    if any(not hasattr(Permission, key) for key in permissions):
        raise ValueError("One or more permissions is invalid")

    return permissions


class EditAccountSchema(BaseModel):
    """
    Fields for editing a user account.
    """

    email: constr(strip_whitespace=True)
    old_password: str
    password: str

    @root_validator
    def check_password(cls, values: Union[str, constr]):
        """
        Checks if old_password has also been input if a new password
        is provided.
        """
        old_password, password = values.get("old_password"), values.get("password")

        if password is not None and old_password is None:
            raise ValueError(
                "The old password needs to be given in order for the password to be changed"
            )

        return values

    @validator("email")
    def check_email(cls, email: Optional[str]) -> str:
        """
        Checks if the given email is valid.
        """
        try:
            validate_email(email)
        except EmailSyntaxError:
            raise ValueError("The format of the email is invalid")

        return email


class EditSettingsSchema(BaseModel):
    """
    Fields for editing a user account's settings.
    """

    show_ids: Optional[bool]
    skip_quick_analyze_dialog: Optional[bool]
    quick_analyze_workflow: Optional[QuickAnalyzeWorkflow]


class CreateKeysSchema(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    permissions: dict = Field(default={})

    _ensure_permissions_is_valid = validator("permissions", allow_reuse=True)(
        check_permissions
    )


class EditKeySchema(BaseModel):
    permissions: dict

    _ensure_permissions_is_valid = validator("permissions", allow_reuse=True)(
        check_permissions
    )


class CreateLoginSchema(BaseModel):
    username: constr(min_length=1)
    password: constr(min_length=1)
    remember: bool = Field(default=False)


class ResetPasswordSchema(BaseModel):
    password: str
    reset_code: str
