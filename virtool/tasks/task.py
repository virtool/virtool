import asyncio
from logging import getLogger
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Dict, List, Callable, Awaitable, TYPE_CHECKING, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.task import Task as TaskModel

import virtool.tasks.models
from virtool.data.utils import get_data_from_app
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
                logger.exception("Encountered error in %s", self)
                await self._set_error(str(err))

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


class Task:

    task_type = None

    def __init__(self, update_task, app, task_id):
        self.app = app
        self.db = app["db"]
        self.pg = app["pg"]
        self.tasks_data = get_data_from_app(app).tasks
        self.run_in_thread = run_in_thread
        self.id = task_id
        self.step = None
        self.steps = []
        self.intermediate = {}
        self.document = None
        self.context = None
        self.errored = False
        self.temp_dir = get_temp_dir()

    def __str__(self):
        return f"<{type(self).__name__} id={self.id} step={self.step.__name__}>"

    async def init_db(self):
        self.document = await get_data_from_app(self.app).tasks.get(self.id)
        self.context = self.document.context

    async def run(self):
        await self.init_db()

        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await get_data_from_app(self.app).tasks.update(
                self.id, TaskUpdate(step=self.step.__name__)
            )

            logger.info("Starting task step '%s.%s'", self.task_type, func.__name__)

            try:
                await func()
            except Exception as err:
                logger.exception("Encountered error in %s", self)
                await self.error(str(err))

        if not self.errored:
            await get_data_from_app(self.app).tasks.complete(self.id)
            self.temp_dir.cleanup()

    async def update_context(self, update: dict) -> dict:
        """
        Update the context field of the current task in SQL database.

        :param update: d dict of data need to be updated
        :return: the context field after updating

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(
                select(virtool.tasks.models.Task).filter_by(id=self.id)
            )
            task = result.scalar()
            for key, value in update.items():
                task.context[key] = value

            self.document = TaskModel(**task.to_dict())
            self.context = self.document.context
            await session.commit()

        return self.context

    async def get_tracker(self, file_size: int = 0):
        """
        Get a :class:``ProgressTracker`` for current step.

        :param file_size: the size of a file that is processing in current step
        :return: a :class:``ProgressTracker``

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(
                select(virtool.tasks.models.Task).filter_by(id=self.id)
            )
            task = result.scalar().to_dict()
            initial = task["progress"]

        total = round((100 - initial) / (len(self.steps) - self.steps.index(self.step)))

        return ProgressTracker(
            self.pg, self.id, total, file_size=file_size, initial=initial
        )

    async def cleanup(self):
        pass

    async def error(self, error: str):
        """
        Update the error field of the current task in SQL database
        and execute a cleanup step.

        :param error: the error message

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(
                select(virtool.tasks.models.Task).filter_by(id=self.id)
            )
            task = result.scalar()
            task.error = error
            await session.commit()

        await self.cleanup()

        logger.info("Task %s encountered error '%s'", self.id, error)


class ProgressTracker:
    def __init__(self, pg, task_id, total, initial=0.0, file_size=0):
        self.pg = pg
        self.task_id = task_id
        self.total = total
        self.initial = initial
        self.file_size = file_size

        self.progress = self.initial
        self.step_completed = self.initial + self.total

    async def add(self, value: int) -> int:
        """
        Add value to progress.

        The value will be automatically convert to progress based on the value and file
        size, and update to the SQL database.

        :param value: the value to be added to progress.
        :return: the new progress after update.

        """
        benchmark_progress = self.progress
        self.progress += (value / self.file_size) * self.total

        if int(benchmark_progress + 1) <= self.progress:
            async with AsyncSession(self.pg) as session:
                result = await session.execute(
                    select(virtool.tasks.models.Task).filter_by(id=self.task_id)
                )
                task = result.scalar()
                task.progress = round(self.progress)

                await session.commit()

        return round(self.progress)
