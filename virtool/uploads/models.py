from datetime import datetime
from typing import Optional, List

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.searchresult import SearchResult
from virtool_core.models.user import UserNested


class UploadMinimal(BaseModel):
    """
    Model for user uploads.
    """

    id: int
    created_at: datetime
    name: str
    name_on_disk: str
    ready: bool
    removed: bool
    removed_at: Optional[datetime]
    reserved: bool
    size: Optional[int]
    type: str
    uploaded_at: Optional[datetime]
    user: UserNested


Upload = UploadMinimal


class UploadSearchResult(SearchResult):
    items: List[UploadMinimal]
