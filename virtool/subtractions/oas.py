from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints
from virtool_core.models.sample_base import SampleNested
from virtool_core.models.subtraction import (
    NucleotideComposition,
    Subtraction,
)

from virtool.api.model import RequestModel


class SubtractionCreateRequest(RequestModel):
    """Used for creating a new Subtraction."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "Foobar", "nickname": "foo", "upload_id": 1234},
        }
    )

    name: Annotated[
        str,
        StringConstraints(min_length=1, strip_whitespace=True),
    ]
    """A unique name for the host (eg. Arabidopsis)."""

    nickname: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
    ] = ""
    """A nickname for the host (eg. Thale cress)."""

    upload_id: int
    """The ID of the upload from which to create the subtraction."""


class SubtractionUpdateRequest(RequestModel):
    """A request validation model for updating a subtraction."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "Arabidopsis", "nickname": "Thale cress"},
        }
    )

    name: Annotated[
        str,
        StringConstraints(min_length=1, strip_whitespace=True),
    ] = None
    """The unique subtraction name."""

    nickname: Annotated[str, StringConstraints(strip_whitespace=True)] = None
    """A nickname for the host."""


class SubtractionCreateResponse(Subtraction):
    """A response model for a new subtraction."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "created_at": "2015-10-06T20:00:00Z",
                "deleted": False,
                "file": {"id": 1234, "name": "test_upload"},
                "files": [],
                "id": "abc123",
                "linked_samples": [],
                "name": "Foobar",
                "nickname": "foo",
                "ready": False,
                "user": {
                    "administrator": False,
                    "handle": "bob",
                    "id": "test",
                },
            },
        },
    )


class SubtractionFinalizeRequest(RequestModel):
    """A request validation model for finalizing a subtraction."""

    count: int = Field(ge=1)
    """The number of sequences in the subtraction."""

    gc: NucleotideComposition
    """The nucleotide composition of the subtraction."""


class SubtractionResponse(Subtraction):
    model_config = ConfigDict(
        json_schema_extra={
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
            },
        },
    )


_nested = [SampleNested]

SubtractionCreateResponse.model_rebuild()
