import enum
from datetime import datetime
from typing import Any

from virtool.models import BaseModel, SearchResult
from virtool.tasks.models import TaskDetailedNested
from virtool.uploads.models import UploadMinimal
from virtool.users.models_base import UserNested


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

    class Config:
        schema_extra = {
            "example": [
                {
                    "build": False,
                    "created_at": "2022-06-10T20:00:34.129000Z",
                    "id": 5,
                    "modify": False,
                    "modify_otu": True,
                    "remove": False,
                },
            ],
        }


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

    class Config:
        schema_extra = {
            "example": [
                {
                    "id": 11447367,
                    "name": "v0.1.1",
                    "body": "#### Fixed\r\n- fixed uploading to GitHub releases in `.travis.yml`",
                    "filename": "reference.json.gz",
                    "size": 3695872,
                    "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.1",
                    "published_at": "2018-06-12T19:20:57Z",
                    "created_at": "2018-06-14T18:37:54.242000Z",
                    "user": {"id": "igboyes"},
                    "ready": True,
                },
            ],
        }


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

    class Config:
        schema_extra = {
            "example": {
                "id": 11449913,
                "name": "v0.1.2",
                "body": "#### Changed\r\n- add new isolates to Cucurbit chlorotic yellows virus",
                "etag": 'W/"b7e8a7fb0fbe0cade0d6a86c9e0d4549"',
                "filename": "reference.json.gz",
                "size": 3699729,
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.2",
                "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v0.1.2/reference.json.gz",
                "published_at": "2018-06-12T21:52:33Z",
                "content_type": "application/gzip",
                "retrieved_at": "2018-06-14T19:52:17.465000Z",
                "newer": True,
            },
        }


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
    imported_from: UploadMinimal | None = None
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

    class Config:
        schema_extra = {
            "example": {
                "cloned_from": {"id": "pat6xdn3", "name": "Plant Viruses"},
                "contributors": [
                    {
                        "administrator": True,
                        "count": 6,
                        "handle": "reece",
                        "id": "hjol9wdt",
                    },
                    {
                        "administrator": True,
                        "count": 7906,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    {
                        "administrator": True,
                        "count": 1563,
                        "handle": "igboyes",
                        "id": "igboyes",
                    },
                    {
                        "administrator": True,
                        "count": 2483,
                        "handle": "jasper",
                        "id": "1kg24j7t",
                    },
                ],
                "created_at": "2022-01-28T23:42:48.321000Z",
                "data_type": "genome",
                "description": "",
                "groups": [
                    {
                        "build": False,
                        "created_at": "2022-06-10T20:00:34.129000Z",
                        "id": "sidney",
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                ],
                "id": "d19exr83",
                "internal_control": None,
                "latest_build": {
                    "created_at": "2022-07-05T17:41:51.857000Z",
                    "has_json": False,
                    "id": "u3lm1rk8",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    "version": 14,
                },
                "name": "New Plant Viruses",
                "organism": "virus",
                "otu_count": 2102,
                "restrict_source_types": False,
                "source_types": ["isolate", "strain"],
                "task": {"id": 331},
                "unbuilt_change_count": 4,
                "user": {"administrator": True, "handle": "igboyes", "id": "igboyes"},
                "users": [
                    {
                        "administrator": True,
                        "build": True,
                        "handle": "igboyes",
                        "id": "igboyes",
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        }


class ReferenceSearchResult(SearchResult):
    documents: list[ReferenceMinimal]
    official_installed: bool

    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "cloned_from": {"id": "pat6xdn3", "name": "Plant Viruses"},
                        "created_at": "2022-01-28T23:42:48.321000Z",
                        "data_type": "genome",
                        "groups": [
                            {
                                "build": False,
                                "created_at": "2022-06-10T20:00:34.129000Z",
                                "id": "sidney",
                                "modify": False,
                                "modify_otu": False,
                                "remove": False,
                            },
                        ],
                        "id": "d19exr83",
                        "internal_control": None,
                        "latest_build": {
                            "created_at": "2022-07-05T17:41:51.857000Z",
                            "has_json": False,
                            "id": "u3lm1rk8",
                            "user": {
                                "administrator": True,
                                "handle": "mrott",
                                "id": "ihvze2u9",
                            },
                            "version": 14,
                        },
                        "name": "New Plant Viruses",
                        "organism": "virus",
                        "otu_count": 2102,
                        "task": {"id": 331},
                        "unbuilt_change_count": 4,
                        "user": {"id": "igboyes"},
                        "users": [
                            {
                                "build": True,
                                "id": "igboyes",
                                "modify": True,
                                "modify_otu": True,
                                "remove": True,
                            },
                        ],
                    },
                ],
                "found_count": 2,
                "official_installed": True,
                "page": 1,
                "page_count": 1,
                "per_page": 25,
                "total_count": 2,
            },
        }
