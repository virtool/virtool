from datetime import datetime
from typing import Any

from pydantic import root_validator
from virtool_core.models.basemodel import BaseModel
from virtool_core.models.ml import MLModelRelease
from virtool_core.models.reference import ReferenceNested

from virtool.indexes.models import IndexNested
from virtool.jobs.models import JobMinimal
from virtool.models import SearchResult, UserNested
from virtool.subtractions.models import SubtractionNested


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


class AnalysisSearchResult(SearchResult):
    documents: list[AnalysisMinimal]
