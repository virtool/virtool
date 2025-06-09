from datetime import datetime
from typing import Any

from pydantic import root_validator

from virtool.indexes.models import IndexNested
from virtool.jobs.models import JobMinimal
from virtool.ml.models import MLModelRelease
from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.references.models import ReferenceNested
from virtool.subtractions.models import SubtractionNested
from virtool.users.models_base import UserNested


class AnalysisSample(BaseModel):
    id: str


class AnalysisMinimal(BaseModel):
    created_at: datetime
    id: str
    index: IndexNested
    job: JobMinimal | None
    ml: MLModelRelease | None
    ready: bool
    reference: ReferenceNested
    sample: AnalysisSample
    subtractions: list[SubtractionNested]
    updated_at: datetime
    user: UserNested
    workflow: str

    @root_validator(pre=True)
    def fill_update_at(cls, values: dict):
        if "updated_at" not in values:
            values["updated_at"] = values["created_at"]

        return values

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
                },
            ],
        }


class AnalysisFile(BaseModel):
    analysis: str
    description: str | None = None
    format: str
    id: int
    name: str
    name_on_disk: str
    size: int | None
    uploaded_at: datetime | None


class Analysis(AnalysisMinimal):
    files: list[AnalysisFile]
    results: dict[str, Any] | None

    class Config:
        schema_extra = {
            "example": {
                "created_at": "2022-08-15T17:42:35.979000Z",
                "files": [
                    {
                        "analysis": "ofv7rp4v",
                        "description": None,
                        "format": "tsv",
                        "id": 3145,
                        "name": "report.tsv",
                        "name_on_disk": "3145-report.tsv",
                        "size": 4120,
                        "uploaded_at": "2022-08-15T17:48:02.467000Z",
                    }
                ],
                "id": "ofv7rp4v",
                "index": {"id": "u3lm1rk8", "version": 14},
                "job": {"id": "us3toy8j"},
                "ready": True,
                "reference": {"id": "d19exr83", "name": "New Plant Viruses"},
                "results": {
                    "hits": [
                        {
                            "abbreviation": "GLRaV3",
                            "id": "6tli5mz3",
                            "isolates": [
                                {
                                    "default": False,
                                    "id": "qauxg1g9",
                                    "sequences": [],
                                    "source_name": "WA-MR",
                                    "source_type": "isolate",
                                }
                            ],
                            "length": 18671,
                            "name": "Grapevine leafroll-associated virus 3",
                            "version": 30,
                        }
                    ],
                    "read_count": 584,
                    "subtracted_count": 0,
                },
                "sample": {"id": "7tu8c5m5"},
                "subtractions": [{"id": "1sk885at", "name": "Vitis vinifera"}],
                "updated_at": "2022-08-15T17:42:35.979000Z",
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflow": "pathoscope_bowtie",
            }
        }


class AnalysisSearchResult(SearchResult):
    documents: list[AnalysisMinimal]
