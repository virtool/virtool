from typing import Annotated

from pydantic import (
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import IndexMinimal
from virtool_core.models.reference import (
    Reference,
    ReferenceDataType,
    ReferenceGroup,
    ReferenceInstalled,
    ReferenceRelease,
    ReferenceSearchResult,
    ReferenceUser,
)

from virtool.api.model import RequestModel

_ALLOWED_REMOTES = ["virtool/ref-plant-viruses"]


class ReferenceCreateRequest(RequestModel):
    """A request model for creating a new reference."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Plant Viruses",
                "organism": "viruses",
                "data_type": "genome",
            },
        },
    )

    clone_from: str = None
    """The ID of the reference that the new reference should be cloned from."""

    data_type: ReferenceDataType = ReferenceDataType.genome
    """The sequence data type."""

    description: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    """A longer description for the reference."""

    import_from: str | None = None
    """The ID of the uploaded file from which the new reference should be imported."""

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            description="the virus name",
            min_length=1,
        ),
    ]

    organism: str = ""
    """The organism represented in the reference (eg. virus)."""

    release_id: str | None = Field(
        default=11447367,
        description="The id of the GitHub release to install.",
    )

    remote_from: str = None
    """A GitHub slug from which to download reference updates."""

    @model_validator(mode="after")
    def check_sources(self: "ReferenceCreateRequest") -> "ReferenceCreateRequest":
        """Check that clone_from, import_from or remote_from are mutually exclusive."""
        # Check if more than one is set
        if (
            sum(bool(x) for x in [self.clone_from, self.import_from, self.remote_from])
            > 1
        ):
            msg = "Only one of clone_from, import_from, and remote_from is allowed"
            raise ValueError(msg)

        # Validate `remote_from` if set
        if self.remote_from and self.remote_from not in _ALLOWED_REMOTES:
            msg = "Provided remote not allowed"
            raise ValueError(msg)

        return self


class CreateReferenceResponse(Reference):
    """A response model for a created reference."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceSearchResponse(ReferenceSearchResult):
    """A response model for a reference search result."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceResponse(Reference):
    """A response model for a reference."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceReleaseResponse(ReferenceRelease):
    """A response model for a reference release."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceTargetUpdate(RequestModel):
    """A model for creating a new reference target.

    This model is nested in a reference update request.
    """

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            description="The display name for the target.",
            min_length=1,
        ),
    ]

    description: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            default="",
            description="A longer description for the target.",
        ),
    ]

    required: Annotated[
        bool,
        Field(
            default=False,
            description="Whether the target is required for isolate validation.",
        ),
    ]

    length: int = None
    """The target length."""


class ReferenceUpdateRequest(RequestModel):
    """A request validation model for updating a reference."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Regulated Pests",
                "organism": "phytoplasma",
                "internal_control": "ah4m5jqz",
            },
        },
    )

    description: Annotated[str, StringConstraints(strip_whitespace=True)] = None
    """A longer description for the reference."""

    internal_control: str = None
    """The ID of the OTU to set as the internal control for the reference."""

    name: Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
    """The name of the reference."""

    organism: Annotated[str, StringConstraints(strip_whitespace=True)] = None
    """The organism represented in the reference (eg. virus)."""

    restrict_source_types: bool = None
    """Whether to restrict the source types of the isolates in the reference."""

    source_types: list[
        Annotated[
            str,
            StringConstraints(min_length=1, strip_whitespace=True),
        ]
    ] = None

    """The allowed source types for the isolates in the reference."""

    targets: list[ReferenceTargetUpdate] = None
    """The target sequences for the reference."""

    @field_validator("targets")
    @classmethod
    def check_duplicate_target_names(
        cls: "ReferenceUpdateRequest",
        targets: list[ReferenceTargetUpdate],
    ) -> list[ReferenceTargetUpdate]:
        """Check that the targets field does not contain duplicate names."""
        if "targets" not in cls.__pydantic_fields_set__:
            return targets

        names = [t.name for t in targets]

        if len(names) != len(set(names)):
            msg = "The targets field may not contain duplicate names"
            raise ValueError(msg)

        return targets


class ReferenceRightsRequest(RequestModel):
    """A validation model for a request to update reference rights."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"build": True, "modify": True}},
    )

    build: bool = None
    """Allow members to build new indexes for the reference."""

    modify: bool = None
    """Allow members to modify the reference metadata and settings."""

    modify_otu: bool = None
    """Allow members to modify the reference’s member OTUs."""

    remove: bool = None
    """Allow members to remove the reference."""


class ReferenceCreateGroupRequest(ReferenceRightsRequest):
    """A validation model for a request to create a new reference group."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"group_id": 2, "modify_otu": True}},
    )

    group_id: int = Field(description="The ID of the user group.")


class ReferenceCreateGroupResponse(ReferenceGroup):
    """A response model for creating a reference group."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceGroupsResponse(ReferenceGroup):
    """A response model for a list of reference groups."""

    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceGroupResponse(ReferenceGroup):
    """A response model for a reference group."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "build": False,
                "created_at": "2022-06-10T20:00:34.129000Z",
                "id": 4,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            },
        },
    )


class ReferenceCreateUserRequest(ReferenceRightsRequest):
    """A validation model for a request to create a new reference user."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"user_id": "sidney", "modify_otu": True}},
    )

    user_id: str
    """The ID of the user to add to the reference."""


class ReferenceUserResponse(ReferenceUser):
    """A response model for a reference user."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "sidney",
                "created_at": "2018-05-23T19:14:04.285000Z",
                "build": False,
                "modify": False,
                "modify_otu": True,
                "remove": False,
            },
        },
    )


class GetReferenceUpdateResponse(ReferenceInstalled):
    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class CreateReferenceUpdateResponse(ReferenceRelease):
    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class IndexCreateResponse(IndexMinimal):
    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )


class ReferenceHistoryResponse(HistorySearchResult):
    model_config = ConfigDict(
        json_schema_extra={
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
        },
    )
