"""Session cleanup task."""

from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from structlog import get_logger

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

logger = get_logger("sessions.tasks")


class SessionCleanupTask(BaseTask):
    """Periodically clean up expired sessions from the database."""

    name = "cleanup_sessions"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.cleanup_expired_sessions]

    async def cleanup_expired_sessions(self) -> None:
        """Clean up expired sessions."""
        deleted_count = await self.data.sessions.cleanup()
        if deleted_count > 0:
            logger.info("cleaned up expired sessions", count=deleted_count)
