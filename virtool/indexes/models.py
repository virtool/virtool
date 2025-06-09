from datetime import datetime

from virtool.jobs.models import JobMinimal
from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.references.models import ReferenceNested
from virtool.users.models_base import UserNested


class IndexNested(BaseModel):
    id: str
    version: int


class IndexMinimal(IndexNested):
    change_count: int
    created_at: datetime
    has_files: bool
    job: JobMinimal | None
    modified_otu_count: int
    ready: bool
    reference: ReferenceNested
    user: UserNested


class IndexContributor(UserNested):
    count: int


class IndexOTU(BaseModel):
    change_count: int
    id: str
    name: str


class IndexFile(BaseModel):
    download_url: str
    id: int
    index: str
    name: str
    size: int | None
    type: str


class Index(IndexMinimal):
    contributors: list[IndexContributor]
    files: list[IndexFile]
    manifest: dict[str, int]
    otus: list[IndexOTU]


class IndexSearchResult(SearchResult):
    documents: list[IndexMinimal]
    modified_otu_count: int
    total_otu_count: int
    change_count: int
