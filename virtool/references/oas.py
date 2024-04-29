from typing import List, Optional, Union

from pydantic import BaseModel, Field, constr, root_validator, validator
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import IndexMinimal
from virtool_core.models.reference import (
    Reference,
    ReferenceGroup,
    ReferenceInstalled,
    ReferenceRelease,
    ReferenceSearchResult,
    ReferenceUser,
)
from virtool_core.models.validators import prevent_none

ALLOWED_REMOTE = ["virtool/ref-plant-viruses"]
ALLOWED_DATA_TYPE = ["barcode", "genome"]


def check_data_type(data_type: str) -> str:
    """Checks that the data type is valid."""
    if data_type not in ALLOWED_DATA_TYPE:
        raise ValueError("data type not allowed")

    return data_type


class CreateReferenceRequest(BaseModel):
    name: constr(strip_whitespace=True) = Field(
        default="",
        description="the virus name",
    )
    description: constr(strip_whitespace=True) = Field(
        default="",
        description="a longer description for the reference",
    )
    data_type: str = Field(default="genome", description="the sequence data type")
    organism: str = Field(default="", description="the organism")
    release_id: Optional[str] = Field(
        default=11447367,
        description="the id of the GitHub release to install",
    )
    clone_from: Optional[str] = Field(
        description="a valid ref_id that the new reference should be cloned from",
    )
    import_from: Optional[str] = Field(
        description="a valid file_id that the new reference should be imported from",
    )
    remote_from: Optional[str] = Field(
        description="a valid GitHub slug to download and update the new reference from",
    )

    _prevent_none = prevent_none(
        "release_id",
        "clone_from",
        "import_from",
        "remote_from",
    )

    @root_validator
    def check_values(cls, values: Union[str, constr]):
        """Checks that only one of clone_from, import_from or
        remote_from are inputted, if any.
        """
        clone_from, import_from, remote_from = (
            values.get("clone_from"),
            values.get("import_from"),
            values.get("remote_from"),
        )

        if clone_from:
            if import_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )
        elif import_from:
            if clone_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )
        elif remote_from:
            if clone_from or import_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )

            if remote_from not in ALLOWED_REMOTE:
                raise ValueError("provided remote not allowed")

        return values

    _data_validation = validator("data_type", allow_reuse=True)(check_data_type)

    class Config:
        schema_extra = {
            "example": {
                "name": "Plant Viruses",
                "organism": "viruses",
                "data_type": "genome",
            },
        }


class CreateReferenceResponse(Reference):
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


class FindReferencesResponse(ReferenceSearchResult):
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


class ReferenceResponse(Reference):
    class Config:
        schema_extra = {
            "example": {
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
        }


class ReferenceReleaseResponse(ReferenceRelease):
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


class ReferenceTargetRequest(BaseModel):
    name: constr(min_length=1)
    description: constr(strip_whitespace=True) = Field(default="")
    required: bool = Field(default=False)
    length: Optional[int]

    _prevent_none = prevent_none("length")


class UpdateReferenceRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None = Field(
        description="the virus name",
    )
    description: constr(strip_whitespace=True) | None = Field(
        description="a longer description for the reference",
    )
    internal_control: str | None = Field(
        description="set the OTU identified by the passed id as the internal control for the reference",
    )
    organism: Optional[constr(strip_whitespace=True)] = Field(
        description="the organism",
    )
    restrict_source_types: Optional[bool] = Field(
        description="option to restrict source types",
    )
    source_types: Optional[List[constr(strip_whitespace=True, min_length=1)]] = Field(
        description="source types",
    )
    targets: Optional[List[ReferenceTargetRequest]] = Field(
        description="list of target sequences",
    )

    _prevent_none = prevent_none(
        "description",
        "internal_control",
        "name",
        "organism",
        "restrict_source_types",
        "source_types",
        "targets",
    )

    class Config:
        schema_extra = {
            "example": {
                "name": "Regulated Pests",
                "organism": "phytoplasma",
                "internal_control": "ah4m5jqz",
            },
        }

    @validator("targets", check_fields=False)
    def check_targets_name(cls, targets):
        """Sets `name` to the provided `id` if it is `None`."""
        names = [t.name for t in targets]

        if len(names) != len(set(names)):
            raise ValueError("The targets field may not contain duplicate names")

        return targets


class ReferenceRightsRequest(BaseModel):
    build: bool | None = Field(
        description="allow members to build new indexes for the reference",
    )
    modify: bool | None = Field(
        description="allow members to modify the reference metadata and settings",
    )
    modify_otu: bool | None = Field(
        description="allow members to modify the reference’s member OTUs",
    )
    remove: bool | None = Field(description="allow members to remove the reference")

    class Config:
        schema_extra = {"example": {"build": True, "modify": True}}

    _prevent_none = prevent_none("*")


class CreateReferenceGroupRequest(ReferenceRightsRequest):
    group_id: int = Field(description="the id of the group to add")

    class Config:
        schema_extra = {"example": {"group_id": 2, "modify_otu": True}}


class CreateReferenceGroupResponse(ReferenceGroup):
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


class ReferenceGroupsResponse(ReferenceGroup):
    class Config:
        schema_extra = {
            "example": [
                {
                    "build": False,
                    "created_at": "2022-06-10T20:00:34.129000Z",
                    "id": 5,
                    "modify": False,
                    "modify_otu": False,
                    "remove": False,
                },
            ],
        }


class ReferenceGroupResponse(ReferenceGroup):
    class Config:
        schema_extra = {
            "example": {
                "build": False,
                "created_at": "2022-06-10T20:00:34.129000Z",
                "id": 4,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            },
        }


class CreateReferenceUserRequest(ReferenceRightsRequest):
    user_id: str = Field(description="the id of the user to add")

    class Config:
        schema_extra = {"example": {"user_id": "sidney", "modify_otu": True}}


class ReferenceUsersResponse(ReferenceUser):
    class Config:
        schema_extra = {
            "example": {
                "id": "sidney",
                "created_at": "2018-05-23T19:14:04.285000Z",
                "build": False,
                "modify": False,
                "modify_otu": True,
                "remove": False,
            },
        }


class GetReferenceUpdateResponse(ReferenceInstalled):
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


class CreateReferenceUpdateResponse(ReferenceRelease):
    class Config:
        schema_extra = {
            "example": {
                "id": 10742520,
                "name": "v0.3.0",
                "body": "The release consists of a gzipped JSON file containing:\r\n\r\n- a `data_type` field with value _genome_\r\n- an `organism` field with value _virus_\r\n- the `version` name (eg. *v0.2.0*)\r\n- a timestamp with the key `created_at`\r\n- virus data compatible for import into Virtool v2.0.0+\r\n\r\nScripts have been updated to follow upcoming convention changes in Virtool v3.0.0.",
                "etag": 'W/"ef123d746a33f88ee44203d3ca6bc2f7"',
                "filename": "reference.json.gz",
                "size": 3709091,
                "html_url": "https://api.github.com/repos/virtool/virtool-database/releases/10742520",
                "download_url": "https://github.com/virtool/virtool-database/releases/download/v0.3.0/reference.json.gz",
                "published_at": "2018-04-26T19:35:33Z",
                "content_type": "application/gzip",
                "newer": True,
                "retrieved_at": "2018-04-14T19:52:17.465000Z",
            },
        }


class CreateReferenceIndexesResponse(IndexMinimal):
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


class ReferenceHistoryResponse(HistorySearchResult):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "created_at": "2022-01-28T23:28:53.881000Z",
                        "description": "Removed Betaflexivirus from Camelia #1 (BFV_CAM1)",
                        "id": "1wfc5x6e.removed",
                        "index": {"id": "s7frhn8n", "version": 1},
                        "method_name": "remove",
                        "otu": {
                            "id": "1wfc5x6e",
                            "name": "Betaflexivirus from Camelia #1",
                            "version": "removed",
                        },
                        "reference": {"id": "pat6xdn3"},
                        "user": {
                            "administrator": True,
                            "handle": "igboyes",
                            "id": "igboyes",
                        },
                    },
                ],
                "total_count": 1419,
                "found_count": 1419,
                "page_count": 710,
                "per_page": 1,
                "page": 1,
            },
        }
