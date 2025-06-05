from virtool.indexes.models import IndexSearchResult, IndexMinimal, Index


class ListIndexesResponse(IndexSearchResult):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "version": 1,
                        "created_at": "2015-10-06T20:00:00Z",
                        "ready": False,
                        "has_files": True,
                        "job": {"id": "bar"},
                        "reference": {"id": "bar"},
                        "user": {
                            "id": "bf1b993c",
                            "handle": "leeashley",
                            "administrator": False,
                        },
                        "id": "bar",
                        "change_count": 4,
                        "modified_otu_count": 3,
                    },
                    {
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
                    },
                ],
                "total_count": 2,
                "found_count": 2,
                "page_count": 1,
                "per_page": 25,
                "page": 1,
                "total_otu_count": 123,
                "change_count": 12,
                "modified_otu_count": 3,
            }
        }


class ReadyIndexesResponse(IndexMinimal):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "version": 1,
                        "created_at": "2015-10-06T20:00:00Z",
                        "ready": True,
                        "has_files": True,
                        "job": {"id": "bar"},
                        "reference": {"id": "bar"},
                        "user": {
                            "id": "bf1b993c",
                            "handle": "leeashley",
                            "administrator": False,
                        },
                        "id": "bar",
                        "change_count": 4,
                        "modified_otu_count": 3,
                    },
                    {
                        "version": 0,
                        "created_at": "2015-10-06T20:00:00Z",
                        "ready": True,
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
                    },
                ]
            }
        }


class GetIndexResponse(Index):
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
