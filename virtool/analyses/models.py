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
from virtool.users.models import UserNested


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
