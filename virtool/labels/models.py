from pydantic import validator

from virtool.models.base import BaseModel
from virtool.models.validators import normalize_hex_color


class LabelNested(BaseModel):
    color: str
    description: str
    id: int
    name: str


class Label(LabelNested):
    count: int

    _normalize_color = validator("color", allow_reuse=True)(normalize_hex_color)

    class Config:
        schema_extra = {
            "example": {
                "color": "#374151",
                "count": 0,
                "description": "dsRNA/binding protein",
                "id": 23,
                "name": "Binding protein",
            }
        }


LabelMinimal = Label
