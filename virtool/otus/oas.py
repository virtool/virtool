from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from virtool_core.models.otu import OTUSearchResult, OTUSegment

from virtool.validation import Unset, UnsetType

_OTU_ABBREVIATION_DESCRIPTION = "An abbreviation (eg. TMV)."
_OTU_NAME_DESCRIPTION = "The full name (eg. (eg. Tobacco mosaic virus)."
_OTU_SCHEMA_DESCRIPTION = "The schema of the OTU."

_ISOLATE_DEFAULT_DESCRIPTION = "Whether the isolate is the default for the OTU."
_ISOLATE_SOURCE_NAME_DESCRIPTION = "The source name (eg. A1)."
_ISOLATE_SOURCE_TYPE_DESCRIPTION = "The source type (eg. strain)."

_SEQUENCE_ACCESSION_DESCRIPTION = "A Genbank accession number."
_SEQUENCE_DEFINITION_DESCRIPTION = "A Genbank definition."
_SEQUENCE_HOST_DESCRIPTION = "The source host."
_SEQUENCE_SEGMENT_DESCRIPTION = "The segment ID."
_SEQUENCE_SEQUENCE_DESCRIPTION = "The nucleotide sequence."
_SEQUENCE_SEQUENCE_PATTERN = r"^[ATCGNRYKM]+$"
_SEQUENCE_TARGET_DESCRIPTION = "The target ID."


class OTUCreateRequest(BaseModel):
    """A request validation model for creating an OTU."""

    abbreviation: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(default="", description=_OTU_ABBREVIATION_DESCRIPTION),
    ]

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            min_length=1,
            description=_OTU_NAME_DESCRIPTION,
        ),
    ]

    schema_: Annotated[
        list[OTUSegment],
        Field(
            alias="schema",
            default_factory=list,
            description=_OTU_SCHEMA_DESCRIPTION,
        ),
    ]


class OTUUpdateRequest(BaseModel):
    """A request validation model for updating an OTU."""

    abbreviation: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(
            default=Unset,
            description=_OTU_ABBREVIATION_DESCRIPTION,
        ),
    ]

    name: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(
            default=Unset,
            description=_OTU_NAME_DESCRIPTION,
            min_length=1,
        ),
    ]

    schema_: list[OTUSegment] | UnsetType = Field(
        alias="schema",
        default=Unset,
        description=_OTU_SCHEMA_DESCRIPTION,
    )


class IsolateCreateRequest(BaseModel):
    """A request validation model for creating an isolate."""

    default: Annotated[
        bool,
        Field(
            default=False,
            description=_ISOLATE_DEFAULT_DESCRIPTION,
        ),
    ]

    source_name: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(default="", description=_ISOLATE_SOURCE_NAME_DESCRIPTION),
    ]

    source_type: Annotated[
        str,
        StringConstraints(strip_whitespace=True, to_lower=True),
        Field(default="", description=_ISOLATE_SOURCE_TYPE_DESCRIPTION),
    ]


class IsolateUpdateRequest(BaseModel):
    """A request validation model for updating an isolate."""

    source_name: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(default=Unset, description=_ISOLATE_SOURCE_NAME_DESCRIPTION),
    ]

    source_type: Annotated[
        str,
        StringConstraints(strip_whitespace=True, to_lower=True),
        Field(default="", description=_ISOLATE_SOURCE_TYPE_DESCRIPTION),
    ]


class SequenceCreateRequest(BaseModel):
    """A request validation model for creating a sequence."""

    accession: Annotated[
        str,
        StringConstraints(strip_whitespace=True, to_upper=True),
        Field(description=_SEQUENCE_ACCESSION_DESCRIPTION, min_length=1),
    ]

    definition: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(description=_SEQUENCE_DEFINITION_DESCRIPTION, min_length=1),
    ]

    host: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(default="", description=_SEQUENCE_HOST_DESCRIPTION),
    ]

    segment: Annotated[
        str | None,
        Field(default=None, description=_SEQUENCE_SEGMENT_DESCRIPTION),
    ]

    sequence: Annotated[
        str,
        StringConstraints(pattern=_SEQUENCE_SEQUENCE_PATTERN, to_upper=True),
        Field(description=_SEQUENCE_SEQUENCE_DESCRIPTION, min_length=1),
    ]

    target: Annotated[
        str | None,
        Field(default=None, description=_SEQUENCE_TARGET_DESCRIPTION),
    ]


class SequenceUpdateRequest(BaseModel):
    """A request validation model for updating a sequence."""

    accession: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True, to_upper=True),
        Field(default=Unset, description=_SEQUENCE_ACCESSION_DESCRIPTION, min_length=1),
    ]

    definition: Annotated[
        str | UnsetType,
        StringConstraints(min_length=1, strip_whitespace=True),
        Field(default=Unset, description=_SEQUENCE_DEFINITION_DESCRIPTION),
    ]

    host: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(default=Unset, description=_SEQUENCE_HOST_DESCRIPTION),
    ]

    segment: str | None | UnsetType = Field(
        default=Unset,
        description=_SEQUENCE_SEGMENT_DESCRIPTION,
    )

    sequence: Annotated[
        str | UnsetType,
        StringConstraints(pattern=_SEQUENCE_SEQUENCE_PATTERN, to_upper=True),
        Field(default=Unset, description=_SEQUENCE_SEQUENCE_DESCRIPTION, min_length=1),
    ]

    target: str | None | UnsetType = Field(
        default=Unset,
        description=_SEQUENCE_TARGET_DESCRIPTION,
    )


class OTUSearchResponse(OTUSearchResult):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "documents": [
                    {
                        "abbreviation": "ABTV",
                        "id": "k77wgf8x",
                        "name": "Abaca bunchy top virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 18,
                    },
                    {
                        "abbreviation": "AbBV",
                        "id": "7hpwj4yh",
                        "name": "Abutilon Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "",
                        "id": "p9ohme8k",
                        "name": "Abutilon golden mosaic Yucatan virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AbMBoV",
                        "id": "qrspg5w3",
                        "name": "Abutilon mosaic Bolivia virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 6,
                    },
                    {
                        "abbreviation": "AbMoBrV",
                        "id": "yb7kpm43",
                        "name": "Abutilon mosaic Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "AbMV",
                        "id": "8540rw7b",
                        "name": "Abutilon mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "3zwrpu3y",
                        "name": "Abutilon yellow mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AcLV",
                        "id": "30n6qo2x",
                        "name": "Aconitum latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "",
                        "id": "x5qw901r",
                        "name": "Actinidia chlorotic ringspot associated virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "",
                        "id": "ss6bios9",
                        "name": "Actinidia emaravirus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 13,
                    },
                    {
                        "abbreviation": "",
                        "id": "nn5gt7db",
                        "name": "Actinidia seed borne latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "xo3khtnd",
                        "name": "Actinidia virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "AVA",
                        "id": "qg8optks",
                        "name": "Actinidia virus A",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVB",
                        "id": "fnhtwiux",
                        "name": "Actinidia virus B",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVX",
                        "id": "5uh1jzzk",
                        "name": "Actinidia virus X",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AYV1",
                        "id": "7ag9wwrr",
                        "name": "Actinidia yellowing virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AYV2",
                        "id": "f87f3cs7",
                        "name": "Actinidia yellowing virus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "e2xpkmgy",
                        "name": "Adonis mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "3ly2pqbk",
                        "name": "Aeonium ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 0,
                    },
                    {
                        "abbreviation": "",
                        "id": "3xa1dbt0",
                        "name": "African cassava mosaic Burkina Faso virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "ACMV",
                        "id": "0ommwgyh",
                        "name": "African cassava mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "iyw0y3ta",
                        "name": "African eggplant mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "set9w2zc",
                        "name": "African eggplant yellowing virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AOPRV",
                        "id": "taecz4c9",
                        "name": "African oil palm ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "",
                        "id": "zgsytbul",
                        "name": "Agave tequilana leaf virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                ],
                "found_count": 2102,
                "modified_count": 1,
                "page": 1,
                "page_count": 85,
                "per_page": 25,
                "total_count": 2102,
            },
        },
    )
