from datetime import datetime

from email_validator import EmailSyntaxError, validate_email
from pydantic import ConstrainedStr, validator

from virtool.groups.models import GroupMinimal, Permissions
from virtool.models.base import BaseModel
from virtool.models.enums import AnalysisWorkflow
from virtool.users.models import User


def check_email(email: str | None) -> str | None:
    """Checks if the given email is valid."""
    if email is None or email == "":
        return email

    try:
        validate_email(email)
    except EmailSyntaxError:
        raise ValueError("The format of the email is invalid")

    return email


class AccountSettings(BaseModel):
    quick_analyze_workflow: AnalysisWorkflow
    show_ids: bool
    show_versions: bool
    skip_quick_analyze_dialog: bool

    class Config:
        schema_extra = {
            "example": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie",
            }
        }


class ConstrainedEmail(ConstrainedStr):
    strip_whitespace = True


class Account(User):
    settings: AccountSettings
    email: ConstrainedEmail

    @validator("email", allow_reuse=True, pre=True)
    def validate_email(cls, v):
        if v is None:
            return ""
        return check_email(v) or ""

    class Config:
        schema_extra = {
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
            }
        }


class APIKey(BaseModel):
    """A user's API key."""

    id: str
    created_at: datetime
    groups: list[GroupMinimal]
    name: str
    permissions: Permissions

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
