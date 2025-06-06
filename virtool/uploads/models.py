from datetime import datetime

from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.users.models import UserNested


class UploadMinimal(BaseModel):
    """Model for user uploads."""

    id: int
    created_at: datetime
    name: str
    name_on_disk: str
    ready: bool
    removed: bool
    removed_at: datetime | None
    reserved: bool
    size: int | None
    type: str
    uploaded_at: datetime | None
    user: UserNested

    class Config:
        schema_extra = {
            "example": [
                {
                    "id": 106,
                    "created_at": "2022-01-22T17:28:21.491000Z",
                    "name": "MPI19_L3_2.fq.gz",
                    "name_on_disk": "106-MPI19_L3_2.fq.gz",
                    "ready": True,
                    "removed": False,
                    "removed_at": None,
                    "reserved": True,
                    "size": 3356803271,
                    "type": "reads",
                    "uploaded_at": "2022-01-22T17:31:59.801000Z",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                }
            ]
        }


Upload = UploadMinimal
"""Complete Upload model with all fields."""


class UploadSearchResult(SearchResult):
    items: list[UploadMinimal]
