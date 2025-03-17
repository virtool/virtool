from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from virtool_core.models.analysis import AnalysisMinimal
from virtool_core.models.enums import AnalysisWorkflow, LibraryType
from virtool_core.models.samples import Sample

from virtool.validation import Unset, UnsetType

AcceptedSampleReadNames = Literal["reads_1.fq.gz", "reads_2.fq.gz"]
"""Accepted read names for sample files."""


class SampleResponse(Sample):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": {"id": 4, "name": "Sidney"},
                "group_read": True,
                "group_write": True,
                "hold": True,
                "host": "Malus domestica",
                "id": "9zn468u9",
                "is_legacy": False,
                "isolate": "",
                "labels": [],
                "library_type": "normal",
                "locale": "",
                "name": "HX8",
                "notes": "",
                "nuvs": False,
                "paired": True,
                "pathoscope": True,
                "quality": {
                    "bases": [
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                    ],
                    "composition": [
                        [29.0, 18.0, 15.0, 36.5],
                        [25.5, 19.0, 31.5, 22.0],
                    ],
                    "count": 94601674,
                    "encoding": "Sanger / Illumina 1.9\n",
                    "gc": 43.0,
                    "length": [150, 150],
                    "sequences": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        18,
                        298,
                    ],
                },
                "reads": [
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_1.fq.gz",
                        "id": 713,
                        "name": "reads_1.fq.gz",
                        "name_on_disk": "reads_1.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3540467819,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:10:27.418000Z",
                    },
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_2.fq.gz",
                        "id": 714,
                        "name": "reads_2.fq.gz",
                        "name_on_disk": "reads_2.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3321721014,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:11:10.743000Z",
                    },
                ],
                "ready": True,
                "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflows": {
                    "aodp": "incompatible",
                    "nuvs": "none",
                    "pathoscope": "none",
                },
            },
        },
    )


class SampleCreateRequest(BaseModel):
    """A request validator for creating a sample."""

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )

    files: list[Any] = Field(min_length=1, max_length=2)
    """The sample files."""

    group: int | None | UnsetType = Unset
    """The group the sample belongs to."""

    host: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    """The source host."""

    isolate: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    """The isolate."""

    labels: Annotated[list[int], Field(default_factory=list)]
    """Labels to apply to the sample."""

    library_type: LibraryType = LibraryType.normal
    """The sample library type."""

    locale: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    """The locale (eg. Canada)."""

    name: Annotated[
        str,
        StringConstraints(min_length=1, strip_whitespace=True),
    ]
    """The name of the sample."""

    notes: str = ""
    """User notes."""

    subtractions: Annotated[list, Field(default_factory=list)]
    """The default subtractions for the sample."""


class CreateSampleResponse(Sample):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": {"id": 4, "name": "Sidney"},
                "group_read": True,
                "group_write": True,
                "hold": True,
                "host": "Malus domestica",
                "id": "9zn468u9",
                "is_legacy": False,
                "isolate": "",
                "labels": [],
                "library_type": "normal",
                "locale": "",
                "name": "HX8",
                "notes": "",
                "nuvs": False,
                "paired": True,
                "pathoscope": True,
                "quality": None,
                "reads": [
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_1.fq.gz",
                        "id": 713,
                        "name": "reads_1.fq.gz",
                        "name_on_disk": "reads_1.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3540467819,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:10:27.418000Z",
                    },
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_2.fq.gz",
                        "id": 714,
                        "name": "reads_2.fq.gz",
                        "name_on_disk": "reads_2.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3321721014,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:11:10.743000Z",
                    },
                ],
                "ready": True,
                "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflows": {
                    "aodp": "incompatible",
                    "nuvs": "none",
                    "pathoscope": "none",
                },
            },
        },
    )


class SampleUpdateRequest(BaseModel):
    """A request validator for updating a sample."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Tobacco mosaic virus",
                "host": "Tobacco",
                "labels": [1, 5, 6],
            },
        },
        use_attribute_docstrings=True,
    )

    host: Annotated[str | UnsetType, StringConstraints(strip_whitespace=True)] = Unset
    """The host."""

    isolate: Annotated[str | UnsetType, StringConstraints(strip_whitespace=True)] = (
        Unset
    )
    """The source isolate."""

    labels: list[int] | UnsetType = Unset
    """Labels to apply to the sample."""

    locale: Annotated[str, StringConstraints(strip_whitespace=True)] | Unset
    """The locale."""

    name: Annotated[
        str | UnsetType,
        StringConstraints(min_length=1, strip_whitespace=True),
    ] = Unset
    """The name."""

    notes: Annotated[str, StringConstraints(strip_whitespace=True)] | Unset
    """User notes."""

    subtractions: list[str] | UnsetType = Unset
    """The default subtractions for the sample."""


class SampleUpdateResponse(Sample):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": {"id": 4, "name": "Sidney"},
                "group_read": True,
                "group_write": True,
                "hold": True,
                "host": "virus",
                "id": "9zn468u9",
                "is_legacy": False,
                "isolate": "",
                "labels": [1, 5, 6],
                "library_type": "normal",
                "locale": "",
                "name": "foo",
                "notes": "",
                "nuvs": False,
                "paired": True,
                "pathoscope": True,
                "quality": {
                    "bases": [
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                    ],
                    "composition": [
                        [29.0, 18.0, 15.0, 36.5],
                        [25.5, 19.0, 31.5, 22.0],
                    ],
                    "count": 94601674,
                    "encoding": "Sanger / Illumina 1.9\n",
                    "gc": 43.0,
                    "length": [150, 150],
                    "sequences": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        18,
                        298,
                    ],
                },
                "reads": [
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_1.fq.gz",
                        "id": 713,
                        "name": "reads_1.fq.gz",
                        "name_on_disk": "reads_1.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3540467819,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:10:27.418000Z",
                    },
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_2.fq.gz",
                        "id": 714,
                        "name": "reads_2.fq.gz",
                        "name_on_disk": "reads_2.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3321721014,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:11:10.743000Z",
                    },
                ],
                "ready": True,
                "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflows": {
                    "aodp": "incompatible",
                    "nuvs": "none",
                    "pathoscope": "none",
                },
            },
        },
    )


class SampleRightsUpdateRequest(BaseModel):
    """A request validator for updating sample rights."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "group": "administrator",
                "group_read": True,
                "group_write": True,
            },
        },
    )

    group: int | None | UnsetType = Unset
    """Which group owns the sample."""

    all_read: bool | UnsetType = Unset
    """Whether all users can read the sample."""

    all_write: bool | UnsetType = Unset
    """Whether all users can write to the sample."""

    group_read: bool | UnsetType = Unset
    """Whether the owner group can read the sample."""

    group_write: bool | UnsetType = Unset
    """Whether the owner group can write to the sample."""


class SampleRightsResponse(Sample):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": 4,
                "group_read": True,
                "group_write": True,
                "hold": True,
                "host": "virus",
                "id": "9zn468u9",
                "is_legacy": False,
                "isolate": "",
                "labels": [1, 5, 6],
                "library_type": "normal",
                "locale": "",
                "name": "foo",
                "notes": "",
                "nuvs": False,
                "paired": True,
                "pathoscope": True,
                "quality": {
                    "bases": [
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                        [36.0, 37.0, 37.0, 37.0, 37.0, 37.0],
                    ],
                    "composition": [
                        [29.0, 18.0, 15.0, 36.5],
                        [25.5, 19.0, 31.5, 22.0],
                    ],
                    "count": 94601674,
                    "encoding": "Sanger / Illumina 1.9\n",
                    "gc": 43.0,
                    "length": [150, 150],
                    "sequences": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        18,
                        298,
                    ],
                },
                "reads": [
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_1.fq.gz",
                        "id": 713,
                        "name": "reads_1.fq.gz",
                        "name_on_disk": "reads_1.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3540467819,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:10:27.418000Z",
                    },
                    {
                        "download_url": "/samples/9zn468u9/reads/reads_2.fq.gz",
                        "id": 714,
                        "name": "reads_2.fq.gz",
                        "name_on_disk": "reads_2.fq.gz",
                        "sample": "9zn468u9",
                        "size": 3321721014,
                        "upload": None,
                        "uploaded_at": "2022-05-21T00:11:10.743000Z",
                    },
                ],
                "ready": True,
                "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflows": {
                    "aodp": "incompatible",
                    "nuvs": "none",
                    "pathoscope": "none",
                },
            },
        },
    )


class ListSampleAnalysesResponse(AnalysisMinimal):
    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {
                    "created_at": "2022-05-21T01:28:55.441000Z",
                    "id": "m9ktiz0i",
                    "index": {"id": "9c5u6wsq", "version": 13},
                    "job": {"id": "bt8nwg9z"},
                    "ready": True,
                    "reference": {"id": "d19exr83", "name": "New Plant Viruses"},
                    "sample": {"id": "9zn468u9"},
                    "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                    "updated_at": "2022-05-21T01:28:55.441000Z",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    "workflow": "pathoscope_bowtie",
                },
            ],
        },
    )


class CreateAnalysisRequest(BaseModel):
    """A request validator for creating an analysis."""

    ml: int | None = None
    """The machine learning model to use for the analysis.

    Only applicable to workflows that support it.
    """

    ref_id: str
    """The reference to use for the analysis."""

    subtractions: Annotated[list[str], Field(default_factory=list)]
    """The subtractions to use for the analysis."""

    workflow: AnalysisWorkflow
    """The workflow to use for the analysis."""


class AnalysisCreateResponse(AnalysisMinimal):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "created_at": "2022-05-21T01:28:55.441000Z",
                "id": "m9ktiz0i",
                "index": {"id": "9c5u6wsq", "version": 13},
                "job": {"id": "bt8nwg9z"},
                "ready": True,
                "reference": {"id": "d19exr83", "name": "New Plant Viruses"},
                "sample": {"id": "9zn468u9"},
                "subtractions": [{"id": "0nhpi36p", "name": "Malus domestica"}],
                "updated_at": "2022-05-21T01:28:55.441000Z",
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflow": "pathoscope_bowtie",
            },
        },
    )


class FinalizeSampleRequest(BaseModel):
    """A request validator for finalizing a sample."""

    quality: dict
    """The quality object for the sample."""
