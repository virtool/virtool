from pydantic import BaseModel, constr, Field, validator

from virtool_core.models import normalize_hex_color


class CreateLabelSchema(BaseModel):
    """
    Label fields for creating a new label.
    """

    name: constr(strip_whitespace=True, min_length=1) = Field(
        description="unique name for the label document"
    )
    color: constr(strip_whitespace=True) = Field(default="#A0AEC0")
    description: constr(strip_whitespace=True) = Field(
        default="", description="description of the document"
    )

    _ensure_color_is_normalized: classmethod = validator("color", allow_reuse=True)(
        normalize_hex_color
    )


class EditLabelSchema(BaseModel):
    """
    Label fields for editing an existing label.
    """

    name: constr(strip_whitespace=True) = Field(
        description="name of the existing label document"
    )
    color: constr(strip_whitespace=True)
    description: constr(strip_whitespace=True) = Field(
        description="description of the existing label document"
    )

    _ensure_color_is_normalized: classmethod = validator("color", allow_reuse=True)(
        normalize_hex_color
    )
