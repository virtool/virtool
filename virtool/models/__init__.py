from virtool_core.models.basemodel import BaseModel


class SearchResult(BaseModel):
    found_count: int
    page: int
    page_count: int
    per_page: int
    total_count: int


class UserNested(BaseModel):
    """A minimal representation of a user that can be nested in other models."""

    id: str
    """The unique ID of the user."""

    handle: str
    """The user's handle."""
