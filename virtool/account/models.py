from datetime import datetime

from email_validator import EmailSyntaxError, validate_email
from pydantic import ConstrainedStr, validator

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.enums import AnalysisWorkflow
from virtool_core.models.group import GroupMinimal, Permissions
from virtool_core.models.user import User


def check_email(email: str | None) -> str | None:
    """Checks if the given email is valid."""
    if email is None:
        return None

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


class ConstrainedEmail(ConstrainedStr):
    strip_whitespace = True


class Account(User):
    settings: AccountSettings
    email: ConstrainedEmail | None

    _email_validation = validator("email", allow_reuse=True)(check_email)


class APIKey(BaseModel):
    id: str
    created_at: datetime
    groups: list[GroupMinimal]
    name: str
    permissions: Permissions
