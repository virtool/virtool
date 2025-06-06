import enum
from datetime import datetime
from typing import Any

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.searchresult import SearchResult
from virtool_core.models.task import TaskDetailedNested
from virtool_core.models.upload import Upload
from virtool_core.models.user import UserNested


class ReferenceClonedFrom(BaseModel):
    id: str
    name: str


class ReferenceDataType(str, enum.Enum):
    barcode = "barcode"
    genome = "genome"


class ReferenceRights(BaseModel):
    build: bool
    modify: bool
    modify_otu: bool
    remove: bool


class ReferenceGroup(ReferenceRights):
    id: int | str
    created_at: datetime
    legacy_id: str | None
    name: str


class ReferenceUser(ReferenceRights):
    created_at: datetime
    handle: str
    id: str


class ReferenceContributor(UserNested):
    count: int


class ReferenceRemotesFrom(BaseModel):
    errors: list[Any]
    slug: str


class ReferenceInstalled(BaseModel):
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


class ReferenceRelease(BaseModel):
    body: str
    content_type: str
    download_url: str
    filename: str
    html_url: str
    id: int
    name: str
    newer: bool
    published_at: datetime
    retrieved_at: datetime
    size: int


class ReferenceBuild(BaseModel):
    created_at: datetime
    id: str
    version: int
    user: UserNested
    has_json: bool


class ReferenceNested(BaseModel):
    id: str
    data_type: ReferenceDataType
    name: str


class ReferenceMinimal(ReferenceNested):
    cloned_from: ReferenceClonedFrom | None = None
    created_at: datetime
    imported_from: Upload | None = None
    installed: ReferenceInstalled | None = None
    internal_control: str | None
    latest_build: ReferenceBuild | None
    organism: str
    otu_count: int
    release: ReferenceRelease | None = None
    remotes_from: ReferenceRemotesFrom | None = None
    task: TaskDetailedNested | None
    unbuilt_change_count: int
    updating: bool | None = None
    user: UserNested


class Reference(ReferenceMinimal):
    contributors: list[ReferenceContributor]
    description: str
    groups: list[ReferenceGroup]
    restrict_source_types: bool
    source_types: list[str]
    targets: list[dict] | None
    users: list[ReferenceUser]


class ReferenceSearchResult(SearchResult):
    documents: list[ReferenceMinimal]
    official_installed: bool
