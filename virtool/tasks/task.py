"""The base class for all Virtool tasks, and associated utilities."""

import asyncio
from asyncio import to_thread
from collections.abc import Awaitable, Callable
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from structlog import get_logger

from virtool.data.errors import ResourceError
from virtool.tasks.oas import UpdateTaskRequest
from virtool.tasks.progress import TaskProgressHandler

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

from virtool.utils import get_temp_dir

logger = get_logger("task")


class BaseTask:
    name: str
    """The name of the task (eg. 'add_subtraction_files')."""

    steps: list[Callable[[], Awaitable]] = []
    """A list of methods that are executed in sequence during the task run."""

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: dict,
        temp_dir: TemporaryDirectory,
    ):
        self.context = context
        """Context provided when the task was spawned."""

        self.data = data
        """The application data layer."""

        self.task_id = task_id
        """The task's unique id."""

        self.temp_dir = temp_dir

        self.temp_path = Path(self.temp_dir.name)
        """
        The ``Path`` to a temporary directory to be used as a scratch space for the
        task.
        """

        self.errored: bool = False
        """Set ``True`` when the task has encountered an error."""

        self.step: Callable | None = None
        """
        The name of the step the task is current executing.

        The value will be ``None`` if the task's ``run`` method has not been called yet.
        """

    def create_progress_handler(self):
        """Get a ``TaskProgressHandler`` that is wired up to the task object's
        progress handling.

        """
        return TaskProgressHandler(self._set_error, self._set_step_progress)

    @classmethod
    async def from_task_id(cls, data: "DataLayer", task_id: int):
        """Create a task object given a ``task_id`` and a reference to the application
        data layer.
        """
        task, temp_dir = await asyncio.gather(
            data.tasks.get(task_id),
            to_thread(get_temp_dir),
        )

        return cls(task_id, data, task.context, temp_dir)

    @property
    def step_name(self) -> str | None:
        if self.step:
            return self.step.__name__

        return None

    @property
    def step_number(self) -> int:
        """The number of the active step."""
        if self.step is None:
            return 0

        return self.steps.index(self.step) + 1

    @property
    def step_progress_basis(self) -> int:
        """The starting progress value for the current step.

        If the step is the second of four, this value would be 25.

        """
        return round(100 * (self.step_number - 1) / (len(self.steps)))

    async def run(self):
        """Run the task."""
        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await self.data.tasks.update(
                self.task_id,
                UpdateTaskRequest(
                    step=self.step.__name__,
                    progress=self.step_progress_basis,
                ),
            )

            log = logger.bind(
                id=self.task_id,
                name=self.name,
                step=self.step.__name__,
            )

            log.info("Starting next task step")

            try:
                await func()
            except Exception as err:
                log.exception("encountered error in task")
                await self._set_error(f"{type(err)}: {err!s}")

        if self.errored:
            await self.cleanup()
        else:
            await self.data.tasks.complete(self.task_id)

        await to_thread(self.temp_dir.cleanup)

    async def cleanup(self):
        """Override this method to run cleanup if the task fails."""

    async def _set_step_progress(self, progress: int):
        """Update the overall progress using the progress of a subtask"""
        await self._set_progress(
            round(self.step_progress_basis + progress * (1 / len(self.steps))),
        )

    async def _set_progress(self, progress: int):
        """Update the overall progress value for the task."""
        await self.data.tasks.update(self.task_id, UpdateTaskRequest(progress=progress))

    async def _set_error(self, error: str):
        """Set task error status"""
        await self.data.tasks.update(self.task_id, UpdateTaskRequest(error=error))
        self.errored = True


def get_task_from_name(task_name: str) -> type[BaseTask]:
    """Get a task subclass by its ``name``.

    For example, ``get_task_from_name("add_subtraction_files")`` will return the
    ``AddSubtractionFilesTask`` class.

    :param task_name: the task name
    """
    matching_task = [cls for cls in BaseTask.__subclasses__() if cls.name == task_name]

    if len(matching_task) != 1:
        raise ResourceError("Invalid task name")

    return matching_task[0]
