from typing import Optional

from pydantic import BaseModel, Field, constr
from virtool_core.models.subtraction import (
    SubtractionMinimal,
    Subtraction,
    NucleotideComposition,
)
from virtool_core.models.validators import prevent_none


class UpdateSubtractionRequest(BaseModel):
    """
    Used when modifying a Subtraction
    """

    name: Optional[constr(strip_whitespace=True, min_length=1)] = Field(
        description="A unique name for the host"
    )
    nickname: Optional[constr(strip_whitespace=True)] = Field(
        description="A nickname for the host"
    )

    class Config:
        schema_extra = {"example": {"name": "Arabidopsis", "nickname": "Thale cress"}}

    _prevent_none = prevent_none("*")


class CreateSubtractionRequest(BaseModel):
    """
    Used for creating a new Subtraction.
    """

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="A unique name for the host (eg. Arabidopsis)"
    )
    nickname: constr(strip_whitespace=True) = Field(
        description="A nickname of the host", default=""
    )
    upload_id: int = Field(description="The unique id of the file")

    class Config:
        schema_extra = {
            "example": {"name": "Foobar", "nickname": "foo", "upload_id": 1234}
        }


class CreateSubtractionResponse(Subtraction):
    class Config:
        schema_extra = {
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
            }
        }


class FinalizeSubtractionRequest(BaseModel):
    count: int
    gc: NucleotideComposition


class GetSubtractionResponse(SubtractionMinimal):
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


class SubtractionResponse(Subtraction):
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
