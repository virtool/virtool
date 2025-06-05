from datetime import datetime

from virtool_core.models.reference import ReferenceNested

from virtool.jobs.models import JobMinimal
from virtool.models import SearchResult, UserNested, VirtoolBaseModel


class IndexNested(VirtoolBaseModel):
    id: str
    version: int


class IndexMinimal(IndexNested):
    change_count: int
    created_at: datetime
    has_files: bool
    job: JobMinimal | None
    modified_otu_count: int
    reference: ReferenceNested
    user: UserNested
    ready: bool


class IndexContributor(UserNested):
    count: int


class IndexOTU(VirtoolBaseModel):
    change_count: int
    id: str
    name: str


class IndexFile(VirtoolBaseModel):
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
