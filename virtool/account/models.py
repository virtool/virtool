from datetime import datetime

from virtool.groups.models import GroupMinimal, Permissions
from virtool.models.base import BaseModel


class APIKey(BaseModel):
    """A user's API key."""

    id: int
    created_at: datetime
    groups: list[GroupMinimal]
    name: str
    permissions: Permissions

    class Config:
        schema_extra = {
            "example": {
                "created_at": "2015-10-06T20:00:00Z",
                "groups": [],
                "id": 42,
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
