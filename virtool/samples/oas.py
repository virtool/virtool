from typing import Any

from pydantic import Field, conlist, constr

from virtool.models import BaseModel
from virtool.models.enums import AnalysisWorkflow, LibraryType
from virtool.models.validators import prevent_none


class CreateSampleRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    host: constr(strip_whitespace=True) = ""
    isolate: constr(strip_whitespace=True) = ""
    group: int | None = None
    locale: constr(strip_whitespace=True) = ""
    library_type: LibraryType = LibraryType.normal
    subtractions: list = Field(default_factory=list)
    files: conlist(item_type=Any, min_items=1, max_items=2)
    notes: str = ""
    labels: list = Field(default_factory=list)


class UpdateSampleRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None
    host: constr(strip_whitespace=True) | None
    isolate: constr(strip_whitespace=True) | None
    locale: constr(strip_whitespace=True) | None
    notes: constr(strip_whitespace=True) | None
    labels: list | None
    subtractions: list | None

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "name": "Tobacco mosaic viru",
                "host": "Tobacco",
                "labels": [1, 5, 6],
            },
        }


class UpdateRightsRequest(BaseModel):
    group: int | str | None
    all_read: bool | None
    all_write: bool | None
    group_read: bool | None
    group_write: bool | None

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "group": "administrator",
                "group_read": True,
                "group_write": True,
            },
        }


class CreateAnalysisRequest(BaseModel):
    """Request body for creating a new analysis."""

    ml: int | None
    ref_id: str
    subtractions: list[str] = Field(default_factory=list)
    workflow: AnalysisWorkflow

    _prevent_none = prevent_none("subtractions")
