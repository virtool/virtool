import enum
from datetime import datetime

from virtool.models import BaseModel, SearchResult
from virtool.tasks.models import TaskDetailedNested
from virtool.uploads.models import UploadMinimal
from virtool.users.models_base import UserNested


class ReferenceClonedFrom(BaseModel):
    id: int
    name: str


class ReferenceDataType(str, enum.Enum):
    genome = "genome"


class ReferenceRights(BaseModel):
    build: bool
    modify: bool
    modify_otu: bool


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
                },
            ],
        }


class ReferenceUser(ReferenceRights):
    created_at: datetime
    handle: str
    id: int


class ReferenceContributor(UserNested):
    count: int


class ReferenceBuild(BaseModel):
    created_at: datetime
    id: int
    version: int
    user: UserNested


class ReferenceNested(BaseModel):
    id: int
    data_type: ReferenceDataType
    name: str


class ReferenceMinimal(ReferenceNested):
    archived: bool
    cloned_from: ReferenceClonedFrom | None = None
    created_at: datetime
    imported_from: UploadMinimal | None = None
    latest_build: ReferenceBuild | None
    organism: str
    otu_count: int
    task: TaskDetailedNested | None
    unbuilt_change_count: int
    user: UserNested


class Reference(ReferenceMinimal):
    contributors: list[ReferenceContributor]
    description: str
    groups: list[ReferenceGroup]
    restrict_source_types: bool
    source_types: list[str]
    users: list[ReferenceUser]

    class Config:
        schema_extra = {
            "example": {
                "archived": False,
                "cloned_from": {"id": 12, "name": "Plant Viruses"},
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
                    },
                ],
                "id": 25,
                "latest_build": {
                    "created_at": "2022-07-05T17:41:51.857000Z",
                    "id": 14,
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
                    },
                ],
            },
        }


class ReferenceSearchResult(SearchResult):
    documents: list[ReferenceMinimal]

    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "archived": False,
                        "cloned_from": {"id": 12, "name": "Plant Viruses"},
                        "created_at": "2022-01-28T23:42:48.321000Z",
                        "data_type": "genome",
                        "groups": [
                            {
                                "build": False,
                                "created_at": "2022-06-10T20:00:34.129000Z",
                                "id": "sidney",
                                "modify": False,
                                "modify_otu": False,
                            },
                        ],
                        "id": 25,
                        "latest_build": {
                            "created_at": "2022-07-05T17:41:51.857000Z",
                            "id": 14,
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
                            },
                        ],
                    },
                ],
                "found_count": 2,
                "page": 1,
                "page_count": 1,
                "per_page": 25,
                "total_count": 2,
            },
        }
