"""Tasks for maintaining uploads."""

from datetime import timedelta
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from structlog import get_logger

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

logger = get_logger("uploads.tasks")

ORPHAN_AGE = timedelta(days=30)
"""The minimum age a reserved upload must reach before it is eligible for reaping."""


class ReapOrphanedUploadsTask(BaseTask):
    """Delete reserved uploads that were never linked to a sample.

    Acts as a backstop for reservations orphaned by failed sample creation or
    deletion paths that do not release their uploads.
    """

    name = "reap_orphaned_uploads"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.reap]

    async def reap(self) -> None:
        """Reap orphaned reserved uploads."""
        reaped_count = await self.data.uploads.reap_orphaned(ORPHAN_AGE)
        if reaped_count > 0:
            logger.info("reaped orphaned reserved uploads", count=reaped_count)
