from virtool.models.base import BaseModel


class SearchResult(BaseModel):
    found_count: int
    page: int
    page_count: int
    per_page: int
    total_count: int
