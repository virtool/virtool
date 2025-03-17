from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)
from virtool_core.models.label import Label
from virtool_core.models.validators import normalize_hex_color

from virtool.validation import Unset, UnsetType

_LABEL_COLOR_DESCRIPTION = "A hexadecimal color for the label."
"""A description for the label ``color`` field."""

_LABEL_NAME_DESCRIPTION = "A unique display name."
"""A description for the label ``name`` field."""

_LABEL_DESCRIPTION_DESCRIPTION = "A longer description for the label."
"""A description for the label ``description`` field."""


class LabelCreateRequest(BaseModel):
    """A request validation model for creating a new label."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "color": "#374151",
                "description": "dsRNA/binding protein",
                "name": "Binding protein",
            },
        },
    )

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            description=_LABEL_NAME_DESCRIPTION,
            min_length=1,
        ),
    ]

    color: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            default="#A0AEC0",
            description=_LABEL_COLOR_DESCRIPTION,
        ),
    ]

    description: Annotated[
        str,
        StringConstraints(strip_whitespace=True),
        Field(
            default="",
            description=_LABEL_DESCRIPTION_DESCRIPTION,
        ),
    ]

    @field_validator("color", mode="after")
    @classmethod
    def check_color(cls: "LabelCreateRequest", color: str) -> str:
        """Ensure that the color is a valid hex color and normalize it."""
        return normalize_hex_color(color)


class LabelCreateResponse(Label):
    """A response model for creating a label."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "color": "#374151",
                "count": 0,
                "description": "dsRNA/binding protein",
                "id": 23,
                "name": "Binding protein",
            },
        },
    )


class LabelUpdateRequest(BaseModel):
    """Label fields for editing an existing label."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "color": "#93C5FD",
                "description": "Field samples from 2022 harvest",
                "name": "Blueberry 2022",
            },
        },
    )

    name: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(default=Unset, description=_LABEL_NAME_DESCRIPTION),
    ]

    color: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(
            default=Unset,
            description=_LABEL_COLOR_DESCRIPTION,
        ),
    ]

    description: Annotated[
        str | UnsetType,
        StringConstraints(strip_whitespace=True),
        Field(
            default=Unset,
            description=_LABEL_DESCRIPTION_DESCRIPTION,
        ),
    ]

    @field_validator("color", mode="after")
    @classmethod
    def check_color(cls: "LabelUpdateRequest", color: str) -> str:
        """Ensure that the color is a valid hex color and normalize it."""
        return normalize_hex_color(color)


class LabelResponse(Label):
    """A response model for a single label."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "color": "#6B7280",
                "count": 0,
                "description": "dsRNA/Ab",
                "id": 22,
                "name": "Ab",
            },
        },
    )
