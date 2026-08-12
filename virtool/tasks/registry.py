"""Registry of task implementations available to the task runner."""

from virtool.blast.task import BLASTSweepTask
from virtool.caches.tasks import LRUCacheEvictionTask
from virtool.data.errors import ResourceError
from virtool.hmm.tasks import HMMInstallTask, HMMRefreshTask
from virtool.indexes.tasks import CreateIndexTask
from virtool.jobs.tasks import JobsTimeoutTask
from virtool.references.tasks import CloneReferenceTask, ImportReferenceTask
from virtool.tasks.task import BaseTask
from virtool.uploads.tasks import ReapOrphanedUploadsTask

TASK_CLASSES: tuple[type[BaseTask], ...] = (
    BLASTSweepTask,
    LRUCacheEvictionTask,
    HMMInstallTask,
    HMMRefreshTask,
    CreateIndexTask,
    JobsTimeoutTask,
    CloneReferenceTask,
    ImportReferenceTask,
    ReapOrphanedUploadsTask,
)

TASK_REGISTRY = {task_class.name: task_class for task_class in TASK_CLASSES}

if len(TASK_REGISTRY) != len(TASK_CLASSES):
    raise RuntimeError("Task names must be unique")


def get_task_from_name(task_name: str) -> type[BaseTask]:
    """Get the registered task class for a task name."""
    try:
        return TASK_REGISTRY[task_name]
    except KeyError:
        raise ResourceError("Invalid task name") from None


def get_available_task_names() -> list[str]:
    """Get the names of all task classes available to the runner."""
    return list(TASK_REGISTRY)
