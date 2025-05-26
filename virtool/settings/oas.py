from typing import Annotated

from pydantic import ConfigDict, StringConstraints
from virtool_core.models.settings import Settings

from virtool.api.model import RequestModel


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


class SettingsUpdateRequest(RequestModel):
    """A request validation model for updating settings."""

    default_source_types: list[str] = None
    """The default source types for new references."""

    enable_api: bool = None
    """Whether the API is enabled."""

    hmm_slug: Annotated[str, StringConstraints(strip_whitespace=True)] = None
    """The slug of the HMM repository to use."""

    minimum_password_length: int = None
    """The minimum length of user passwords."""

    sample_group: str | None = None
    """The policy for sample group permissions. One of 'none', 'force_choice', or
    'all'.
    """

    sample_group_read: bool = None
    """Whether users can read samples in groups by default."""

    sample_group_write: bool = None
    """Whether users can write samples in groups by default."""

    sample_all_read: bool = None
    """Whether users can read all samples by default."""

    sample_all_write: bool = None
    """Whether users can write all samples by default."""
