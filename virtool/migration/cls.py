from dataclasses import dataclass
from datetime import datetime
from typing import Awaitable, Callable

from virtool.migration.ctx import MigrationContext


@dataclass
class Revision:
    """A Virtool data revision loaded from the filesystem."""

    id: str
    created_at: datetime
    name: str
    upgrade: Callable[[MigrationContext], Awaitable[None]]
    depends_on: str


@dataclass
class AppliedRevision:
    """A Virtool data revision that has been applied to the instance."""

    id: int
    applied_at: datetime
    created_at: datetime
    name: str
    revision: str
