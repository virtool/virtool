from typing import Optional
from pydantic import BaseModel, Field, constr


class EditSubtractionSchema(BaseModel):
    """
    Used when modifying a Subtraction
    """

    name: Optional[constr(strip_whitespace=True, min_length=1)] = Field(
        description="A unique name for the host (eg. " "Arabidopsis)"
    )
    nickname: Optional[constr(strip_whitespace=True)] = Field(
        description="A nickname of the host"
    )


class CreateSubtractionSchema(BaseModel):
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
