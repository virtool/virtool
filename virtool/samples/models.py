import datetime
from enum import Enum

from virtool.groups.models import GroupMinimal
from virtool.jobs.models import JobMinimal
from virtool.labels.models import LabelNested
from virtool.models import BaseModel, SearchResult
from virtool.models.enums import LibraryType
from virtool.samples.models_base import SampleNested
from virtool.subtractions.models import SubtractionNested
from virtool.uploads.models import UploadMinimal
from virtool.users.models_base import UserNested


class SampleArtifact(BaseModel):
    id: int
    download_url: str
    name: str
    size: int


class WorkflowState(Enum):
    """The state of a workflow for a sample."""

    COMPLETE = "complete"
    """The workflow has completed successfully for a sample."""

    INCOMPATIBLE = "incompatible"
    """The workflow is incompatible with a sample."""

    NONE = "none"
    """The workflow is compatible with the sample, but has not been started."""

    PENDING = "pending"
    """The workflow is currently running, but not complete."""


class SampleWorkflows(BaseModel):
    aodp: WorkflowState
    nuvs: WorkflowState
    pathoscope: WorkflowState


class SampleMinimal(SampleNested):
    created_at: datetime.datetime
    host: str
    isolate: str
    job: JobMinimal | None = None
    labels: list[LabelNested]
    library_type: LibraryType
    notes: str
    nuvs: bool | str
    pathoscope: bool | str
    ready: bool
    uploads: list[UploadMinimal] | None = None
    user: UserNested
    workflows: SampleWorkflows

    class Config:
        schema_extra = {
            "example": [
                {
                    "created_at": "2022-05-20T23:48:00.901000Z",
                    "host": "Malus domestica",
                    "id": "9zn468u9",
                    "isolate": "",
                    "labels": [],
                    "library_type": "normal",
                    "name": "HX8",
                    "notes": "",
                    "nuvs": False,
                    "pathoscope": True,
                    "ready": True,
                    "subtractions": ["0nhpi36p"],
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    "workflows": {
                        "aodp": "incompatible",
                        "nuvs": "none",
                        "pathoscope": "none",
                    },
                },
            ],
        }


class Quality(BaseModel):
    bases: list[list[int | float]]
    composition: list[list[int | float]]
    count: int
    encoding: str
    gc: int | float
    length: list[int]
    sequences: list[int]


class Read(BaseModel):
    download_url: str
    id: int
    name: str
    name_on_disk: str
    sample: str
    size: int
    upload: UploadMinimal | None
    uploaded_at: datetime.datetime


class Sample(SampleMinimal):
    all_read: bool
    all_write: bool
    artifacts: list[SampleArtifact]
    format: str
    group: GroupMinimal | None
    group_read: bool
    group_write: bool
    hold: bool
    is_legacy: bool
    locale: str
    paired: bool
    quality: Quality | None
    reads: list[Read]
    subtractions: list[SubtractionNested]

    class Config:
        schema_extra = {
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
        }


class SampleSearchResult(SearchResult):
    documents: list[SampleMinimal]
