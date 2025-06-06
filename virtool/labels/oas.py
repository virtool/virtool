from pydantic import BaseModel, Field, constr, validator

from virtool.models.validators import normalize_hex_color, prevent_none


class CreateLabelRequest(BaseModel):
    """Label fields for creating a new label."""

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="unique name for the label document"
    )
    color: constr(strip_whitespace=True) = Field(
        default="#A0AEC0", description="color of the label"
    )
    description: constr(strip_whitespace=True) = Field(
        default="", description="description of the document"
    )

    _ensure_color_is_normalized: classmethod = validator("color", allow_reuse=True)(
        normalize_hex_color
    )

    class Config:
        schema_extra = {
            "example": {
                "color": "#374151",
                "description": "dsRNA/binding protein",
                "name": "Binding protein",
            }
        }


class UpdateLabelRequest(BaseModel):
    """Label fields for editing an existing label."""

    name: constr(strip_whitespace=True) | None = Field(
        description="A short display name"
    )
    color: constr(strip_whitespace=True) | None = Field(
        description="A hexadecimal color for the label"
    )
    description: constr(strip_whitespace=True) | None = Field(
        description="A longer description for the label"
    )

    _ensure_color_is_normalized: classmethod = validator("color", allow_reuse=True)(
        normalize_hex_color
    )

    _prevent_none = prevent_none("*")

    class Config:
        schema_extra = {
            "example": {
                "color": "#93C5FD",
                "description": "Field samples from 2022 harvest",
                "name": "Blueberry 2022",
            }
        }
