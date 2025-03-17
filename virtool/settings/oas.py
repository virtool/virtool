from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from virtool_core.models.settings import Settings

from virtool.validation import Unset, UnsetType


class SettingsResponse(Settings):
    """A response model for the settings endpoint."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_source_types": ["isolate", "strain"],
                "enable_api": True,
                "enable_sentry": True,
                "hmm_slug": "virtool/virtool-hmm",
                "minimum_passsword_length": 8,
                "sample_all_read": False,
                "sample_all_write": True,
                "sample_group": "force_choice",
                "sample_group_read": True,
                "sample_group_write": True,
                "sample_unique_names": True,
            },
        },
    )


class SettingsUpdateRequest(BaseModel):
    """A request validation model for updating settings."""

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )

    default_source_types: Annotated[
        list[str] | UnsetType,
        Field(default_factory=lambda: ["isolate", "strain"]),
    ] = Unset
    """The default source types for new references."""

    enable_api: bool | UnsetType = Unset
    """Whether the API is enabled."""

    hmm_slug: Annotated[str | UnsetType, StringConstraints(strip_whitespace=True)] = (
        Unset
    )
    """The slug of the HMM repository to use."""

    minimum_password_length: int | UnsetType = Unset
    """The minimum length of user passwords."""

    sample_group: str | None | UnsetType = Unset
    """The policy for sample group permissions. One of 'none', 'force_choice', or
    'all'.
    """

    sample_group_read: bool | UnsetType = Unset
    """Whether users can read samples in groups by default."""

    sample_group_write: bool | UnsetType = Unset
    """Whether users can write samples in groups by default."""

    sample_all_read: bool | UnsetType = Unset
    """Whether users can read all samples by default."""

    sample_all_write: bool | UnsetType = Unset
    """Whether users can write all samples by default."""
