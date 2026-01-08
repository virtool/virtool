from datetime import datetime

from virtool.jobs.models import JobMinimal
from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.samples.models_base import SampleNested
from virtool.uploads.models import UploadMinimal
from virtool.users.models_base import UserNested


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

    class Config:
        schema_extra = {
            "example": [
                {
                    "count": 9,
                    "created_at": "2021-12-21T23:52:13.185000Z",
                    "file": {"id": 58, "name": "arabidopsis_thaliana_+_plastids.fa.gz"},
                    "id": "q0ek30si",
                    "name": "Arabidopsis thaliana",
                    "nickname": "",
                    "ready": True,
                    "user": {
                        "administrator": True,
                        "handle": "igboyes",
                        "id": "igboyes",
                    },
                }
            ]
        }


class Subtraction(SubtractionMinimal):
    """Complete Subtraction model."""

    files: list[SubtractionFile]
    gc: NucleotideComposition | None
    linked_samples: list[SampleNested]
    upload: UploadMinimal | None = None

    class Config:
        schema_extra = {
            "example": {
                "count": 9,
                "created_at": "2021-12-21T23:52:13.185000Z",
                "deleted": False,
                "file": {"id": 58, "name": "arabidopsis_thaliana_+_plastids.fa.gz"},
                "files": [
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.1.bt2",
                        "id": 39,
                        "name": "subtraction.1.bt2",
                        "size": 44200803,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.2.bt2",
                        "id": 37,
                        "name": "subtraction.2.bt2",
                        "size": 30000964,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.3.bt2",
                        "id": 42,
                        "name": "subtraction.3.bt2",
                        "size": 3275,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.4.bt2",
                        "id": 40,
                        "name": "subtraction.4.bt2",
                        "size": 30000958,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.fa.gz",
                        "id": 36,
                        "name": "subtraction.fa.gz",
                        "size": 36160657,
                        "subtraction": "q0ek30si",
                        "type": "fasta",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.rev.1.bt2",
                        "id": 41,
                        "name": "subtraction.rev.1.bt2",
                        "size": 44200803,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                    {
                        "download_url": "/subtractions/q0ek30si/files/subtraction.rev.2.bt2",
                        "id": 38,
                        "name": "subtraction.rev.2.bt2",
                        "size": 30000964,
                        "subtraction": "q0ek30si",
                        "type": "bowtie2",
                    },
                ],
                "gc": {"a": 0.319, "c": 0.18, "g": 0.18, "n": 0.002, "t": 0.319},
                "id": "q0ek30si",
                "linked_samples": [
                    {"id": "2izth91q", "name": "21BP074"},
                    {"id": "noni4fpk", "name": "21BP075"},
                    {"id": "o3ldvwpm", "name": "22SP001-M"},
                    {"id": "gobtw98t", "name": "22SP001-R"},
                ],
                "name": "Arabidopsis thaliana",
                "nickname": "",
                "ready": True,
                "user": {"administrator": True, "handle": "igboyes", "id": "igboyes"},
            }
        }


class SubtractionSearchResult(SearchResult):
    ready_count: int
    documents: list[SubtractionMinimal]
