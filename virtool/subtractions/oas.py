from pydantic import Field, constr

from virtool.models import BaseModel
from virtool.models.validators import prevent_none
from virtool.subtractions.models import (
    NucleotideComposition,
)


class UpdateSubtractionRequest(BaseModel):
    """Used when modifying a Subtraction."""

    name: constr(strip_whitespace=True, min_length=1) | None = Field(
        description="A unique name for the host"
    )
    nickname: constr(strip_whitespace=True) | None = Field(
        description="A nickname for the host"
    )

    class Config:
        schema_extra = {"example": {"name": "Arabidopsis", "nickname": "Thale cress"}}

    _prevent_none = prevent_none("*")


class CreateSubtractionRequest(BaseModel):
    """Used for creating a new Subtraction."""

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


class FinalizeSubtractionRequest(BaseModel):
    count: int
    gc: NucleotideComposition
