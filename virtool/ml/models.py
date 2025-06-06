from __future__ import annotations

import datetime

from virtool_core.models.basemodel import BaseModel


class MLModelReleaseMinimal(BaseModel):
    id: int
    """The unique ID for the release."""

    created_at: datetime.datetime
    """When the release was loaded into the Virtool instance."""

    github_url: str
    """The URL to the release HTML page for the release on GitHub."""

    name: str
    """The name of the release (eg. 1.1.2)."""

    published_at: datetime.datetime
    """When the release was published on GitHub."""

    ready: bool
    """Whether the release is ready for use."""

    size: int
    """The size of the model data file."""


class MLModelNested(BaseModel):
    """A machine learning model"""

    id: int
    """The unique ID for the model."""

    created_at: datetime.datetime
    """When the model was loaded into the Virtool instance."""

    description: str
    """A description of the model."""

    name: str
    """The name of the model."""


class MLModelMinimal(MLModelNested):
    release_count: int
    """The number of releases for the model."""

    latest_release: MLModelReleaseMinimal | None
    """The latest release of the model."""


class MLModelRelease(MLModelReleaseMinimal):
    """A release of a machine learning model"""

    download_url: str
    """The URL to download the model data file."""

    model: MLModelNested
    """The machine learning model."""


class MLModel(MLModelMinimal):
    """A machine learning model"""

    releases: list[MLModelReleaseMinimal]
    """The available releases for the model."""


class MLModelListResult(BaseModel):
    """A search result for an ML model"""

    items: list[MLModelMinimal]
    """The available ML models."""

    last_synced_at: datetime.datetime | None
    """When the models where last synced with www.virtool.ca."""
