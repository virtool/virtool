from datetime import datetime
from typing import Any, List, Optional, Union

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.reference import ReferenceNested
from virtool_core.models.searchresult import SearchResult
from virtool_core.models.user import UserNested


class HistoryIndex(BaseModel):
    id: str
    version: Union[int, str]


class HistoryOTU(BaseModel):
    id: str
    name: str
    version: Union[int, str]


class HistoryNested(BaseModel):
    created_at: datetime
    """
    When the change was made.
    """

    description: str
    """
    A human readable description for the change.
    """

    id: str
    """
    The unique ID for the change.
    """

    method_name: HistoryMethod
    """
    The name of the method that made the change (eg. edit_sequence). 
    """

    user: UserNested
    """
    Identifying information for the user that made the change.
    """


class HistoryMinimal(HistoryNested):
    index: Optional[HistoryIndex]
    """
    The index the change is included in.
    
    This is optional as not all changes are included in an index.
    
    """

    otu: HistoryOTU
    """
    The name, ID, and version of the OTU the change affects.
    """

    reference: ReferenceNested
    """
    The ID of the reference the change is associated with.
    """


class History(HistoryMinimal):
    diff: Any
    """
    The JSON diff for the change.
    
    Generated using ``dictdiffer``.
    """


class HistorySearchResult(SearchResult):
    documents: List[HistoryMinimal]
