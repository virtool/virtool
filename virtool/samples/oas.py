from typing import Any, Optional

from pydantic import BaseModel, Field, conlist, constr
from virtool_core.models.analysis import AnalysisMinimal
from virtool_core.models.enums import LibraryType, QuickAnalyzeWorkflow
from virtool_core.models.samples import Sample, SampleMinimal
from virtool_core.models.validators import prevent_none


class GetSamplesResponse(SampleMinimal):
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
                }
            ]
        }


class GetSampleResponse(Sample):
    class Config:
        schema_extra = {
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "caches": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": "sidney",
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
            }
        }


class CreateSampleRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    host: constr(strip_whitespace=True) = ""
    isolate: constr(strip_whitespace=True) = ""
    group: Optional[str] = None
    locale: constr(strip_whitespace=True) = ""
    library_type: LibraryType = LibraryType.normal
    subtractions: list = Field(default_factory=lambda: [])
    files: conlist(item_type=Any, min_items=1, max_items=2)
    notes: str = ""
    labels: list = Field(default_factory=lambda: [])


class CreateSampleResponse(Sample):
    class Config:
        schema_extra = {
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "caches": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": "sidney",
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
            }
        }


class UpdateSampleRequest(BaseModel):
    name: Optional[constr(strip_whitespace=True, min_length=1)]
    host: Optional[constr(strip_whitespace=True)]
    isolate: Optional[constr(strip_whitespace=True)]
    locale: Optional[constr(strip_whitespace=True)]
    notes: Optional[constr(strip_whitespace=True)]
    labels: Optional[list]
    subtractions: Optional[list]

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "name": "Tobacco mosaic viru",
                "host": "Tobacco",
                "labels": [1, 5, 6],
            }
        }


class UpdateSampleResponse(Sample):
    class Config:
        schema_extra = {
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "caches": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": "sidney",
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
            }
        }


class UpdateRightsRequest(BaseModel):
    group: Optional[str]
    all_read: Optional[bool]
    all_write: Optional[bool]
    group_read: Optional[bool]
    group_write: Optional[bool]

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "group": "administrator",
                "group_read": True,
                "group_write": True,
            }
        }


class UpdateRightsResponse(Sample):
    class Config:
        schema_extra = {
            "example": {
                "all_read": False,
                "all_write": False,
                "artifacts": [],
                "caches": [],
                "created_at": "2022-05-20T23:48:00.901000Z",
                "format": "fastq",
                "group": "administrator",
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
            }
        }


class GetSampleAnalysesResponse(AnalysisMinimal):
    class Config:
        schema_extra = {
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
                }
            ]
        }


class CreateAnalysisRequest(BaseModel):
    ref_id: str
    subtractions: Optional[list]
    workflow: QuickAnalyzeWorkflow

    _prevent_none = prevent_none("subtractions")


class CreateAnalysisResponse(AnalysisMinimal):
    class Config:
        schema_extra = {
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
            }
        }
