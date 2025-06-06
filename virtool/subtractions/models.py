from datetime import datetime

from virtool.jobs.models import JobMinimal
from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.samples.models_base import SampleNested
from virtool.users.models import UserNested


class NucleotideComposition(BaseModel):
    a: float
    c: float
    g: float
    t: float
    n: float


class SubtractionFile(BaseModel):
    download_url: str
    id: int
    name: str
    size: int
    subtraction: str
    type: str


class SubtractionUpload(BaseModel):
    id: int | str
    name: str


class SubtractionNested(BaseModel):
    id: str
    name: str


class SubtractionMinimal(SubtractionNested):
    """Minimal Subtraction model used for websocket messages and resource listings."""

    count: int | None
    created_at: datetime
    file: SubtractionUpload
    job: JobMinimal | None
    nickname: str
    ready: bool
    user: UserNested | None


class Subtraction(SubtractionMinimal):
    """Complete Subtraction model."""

    files: list[SubtractionFile]
    gc: NucleotideComposition | None
    linked_samples: list[SampleNested]


class SubtractionSearchResult(SearchResult):
    ready_count: int
    documents: list[SubtractionMinimal]
