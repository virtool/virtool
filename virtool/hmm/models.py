from datetime import datetime
from typing import List, Any

from pydantic import validator

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.searchresult import SearchResult
from virtool_core.models.task import Task
from virtool_core.models.user import UserNested


class HMMInstalled(BaseModel):
    body: str
    created_at: datetime
    filename: str
    html_url: str
    id: int
    name: str
    newer: bool
    published_at: datetime
    ready: bool
    size: int
    user: UserNested


class HMMRelease(BaseModel):
    body: str
    content_type: str
    download_url: str
    etag: str
    filename: str
    html_url: str
    id: int
    name: str
    newer: bool
    published_at: datetime
    retrieved_at: datetime
    size: int


class HMMStatus(BaseModel):
    errors: List[str]
    installed: HMMInstalled | None
    release: HMMRelease | None
    task: Task | None
    updating: bool


class HMMMinimal(BaseModel):
    id: str
    cluster: int
    count: int
    families: dict[str, int]
    names: List[str]

    @validator("names")
    def is_name_valid(cls, names: List[str]) -> List[str]:
        if len(names) > 3:
            raise ValueError("The length of name should be a maximum of 3")

        return names


class HMMSequenceEntry(BaseModel):
    accession: str
    gi: str
    name: str
    organism: str


class HMM(HMMMinimal):
    entries: List[HMMSequenceEntry]
    genera: dict[str, int]
    length: int
    mean_entropy: float
    total_entropy: float


class HMMSearchResult(SearchResult):
    documents: List[HMMMinimal]
    status: dict[str, Any]
