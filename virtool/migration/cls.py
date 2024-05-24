from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Awaitable, Callable

from virtool.migration.ctx import MigrationContext


class RevisionSource(str, Enum):
    """The source of a revision."""

    ALEMBIC = "alembic"
    VIRTOOL = "virtool"


@dataclass
class AppliedRevision:
    """A Virtool data revision that has been applied to the instance."""

    id: int
    applied_at: datetime
    created_at: datetime
    name: str
    revision: str


@dataclass
class GenericRevision:
    """Represents either a Virtool or Alembic revision."""

    alembic_downgrade: str | None
    created_at: datetime
    id: str
    name: str
    source: RevisionSource
    upgrade: Callable[[MigrationContext], Awaitable[None]]
    virtool_downgrade: str | None


class MigrationError(Exception):
    """Raised when an error occurs during a migration."""
