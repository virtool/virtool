from typing import Any

from pydantic import Field, conlist, constr, root_validator

from virtool.models import BaseModel
from virtool.models.enums import LibraryType


class CreateSampleRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    host: constr(strip_whitespace=True) = ""
    isolate: constr(strip_whitespace=True) = ""
    group: int | None = None
    locale: constr(strip_whitespace=True) = ""
    library_type: LibraryType = LibraryType.normal
    subtractions: list[int] = Field(default_factory=list)
    files: conlist(item_type=Any, min_items=1, max_items=2)
    notes: str = ""
    labels: list = Field(default_factory=list)

    @root_validator
    def validate_group(cls, values):
        group = values.get("group")

        if group == "none":
            values["group"] = None

        return values
