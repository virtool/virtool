import asyncio
from logging import getLogger
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Dict, List, Callable, Awaitable, TYPE_CHECKING, Optional

from virtool.tasks.oas import TaskUpdate
from virtool.tasks.progress import TaskProgressHandler
from virtool.utils import get_temp_dir, run_in_thread

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


logger = getLogger("task")


class BaseTask:

    name: str
    """The name of the task (eg. 'add_subtraction_files')."""

    steps: List[Callable[[], Awaitable]] = []
    """A list of methods that are executed in sequence during the task run."""

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
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

        self.step: Optional[Callable] = None
        """
        The name of the step the task is current executing.

        The value will be ``None`` if the task's ``run`` method has not been called yet.
        """

    def create_progress_handler(self):
        """
        Get a ``TaskProgressHandler`` that is wired up to the task object's
        progress handling.

        """
        return TaskProgressHandler(self._set_error, self._set_step_progress)

    @classmethod
    async def from_task_id(cls, data: "DataLayer", task_id: int):
        """
        Create a task object given a ``task_id`` and a reference to the application data
        layer.

        """
        task, temp_dir = await asyncio.gather(
            data.tasks.get(task_id), run_in_thread(get_temp_dir)
        )

        return cls(task_id, data, task.context, temp_dir)

    @property
    def step_name(self) -> str:
        if self.step:
            return self.step.__name__

    @property
    def step_number(self) -> int:
        """
        The number of the active step.

        """
        if self.step is None:
            return 0

        return self.steps.index(self.step) + 1

    @property
    def step_progress_basis(self) -> int:
        """
        The starting progress value for the current step.

        If the step is the second of four, this value would be 25.

        """
        return round(100 * (self.step_number - 1) / (len(self.steps)))

    async def run(self):
        """
        Run the task.

        """

        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await self.data.tasks.update(
                self.task_id,
                TaskUpdate(
                    step=self.step.__name__,
                    progress=self.step_progress_basis,
                ),
            )

            logger.info("Starting task step '%s.%s'", self.name, func.__name__)

            try:
                await func()
            except Exception as err:
                logger.exception(f"Encountered error in task {self.task_id}")
                await self._set_error(f"{type(err)}: {str(err)}")

        if not self.errored:
            await self.data.tasks.complete(self.task_id)

        await run_in_thread(self.temp_dir.cleanup)

    async def cleanup(self):
        """
        Override this method to run cleanup if the task fails.
        """
        ...

    async def _set_step_progress(self, progress: int):
        """
        Update the overall progress using the progress of a subtask
        """
        await self._set_progress(
            round(self.step_progress_basis + progress * (1 / len(self.steps)))
        )

    async def _set_progress(self, progress: int):
        """
        Update the overall progress value for the task.
        """
        await self.data.tasks.update(self.task_id, TaskUpdate(progress=progress))

    async def _set_error(self, error: str):
        """
        Set task error status
        """
        await self.data.tasks.update(self.task_id, TaskUpdate(error=error))
        self.errored = True
