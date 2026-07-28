from datetime import datetime

from virtool.models.base import BaseModel
from virtool.models.enums import HistoryMethod
from virtool.users.models_base import UserNested


class HistoryNested(BaseModel):
    created_at: datetime
    """When the change was made."""

    description: str
    """A human readable description for the change."""

    id: str
    """The unique ID for the change."""

    method_name: HistoryMethod
    """The name of the method that made the change (eg. edit_sequence)."""

    user: UserNested
    """Identifying information for the user that made the change."""
