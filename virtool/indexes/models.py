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

    class Config:
        schema_extra = {
            "example": {
                "change_count": 0,
                "created_at": "2015-10-06T20:00:00Z",
                "has_files": True,
                "id": "fb085f7f",
                "job": {"id": "bf1b993c"},
                "modified_otu_count": 0,
                "ready": False,
                "reference": {"id": "foo"},
                "user": {"administrator": False, "handle": "bob", "id": "test"},
                "version": 9,
            },
        }


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

    class Config:
        schema_extra = {
            "example": {
                "version": 0,
                "created_at": "2015-10-06T20:00:00Z",
                "ready": False,
                "has_files": True,
                "job": {"id": "foo"},
                "reference": {"id": "foo"},
                "user": {
                    "id": "bf1b993c",
                    "handle": "leeashley",
                    "administrator": False,
                },
                "id": "foo",
                "change_count": 2,
                "modified_otu_count": 2,
                "contributors": [
                    {
                        "count": 1,
                        "id": "fred",
                    },
                    {
                        "count": 3,
                        "id": "igboyes",
                    },
                ],
                "files": [],
                "otus": [
                    {
                        "change_count": 1,
                        "id": "kjs8sa99",
                        "name": "Foo",
                    },
                    {
                        "change_count": 3,
                        "id": "zxbbvngc",
                        "name": "Test",
                    },
                ],
                "manifest": [],
            },
        }


class IndexSearchResult(SearchResult):
    documents: list[IndexMinimal]
    modified_otu_count: int
    total_otu_count: int
    change_count: int
