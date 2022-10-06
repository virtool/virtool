from logging import getLogger
from pathlib import Path
from typing import Dict, List, Callable, Awaitable, TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


import virtool.tasks.models

from virtool.tasks.oas import TaskUpdate
from virtool.tasks.progress import AbstractProgressHandler, TaskProgressHandler
from virtool.utils import get_temp_dir, run_in_thread
from virtool.data.utils import get_data_from_app
from virtool_core.models.task import Task as TaskModel

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


logger = getLogger("task")


class Task2:
    steps: List[Callable[[], Awaitable]] = []
    task_type: str

    def __init__(self, task_id: int, data: "DataLayer", context: Dict, temp_dir: Path):
        self.context = context
        self.data = data
        self.task_id = task_id
        self.temp_dir = temp_dir

        self.errored = False
        self.step = None

    def create_progress_handler(self):
        """
        Get a ``TaskProgressHandler`` that is wired up to the task progress handling.
        """
        return TaskProgressHandler(self._set_error, self._set_step_progress)

    @classmethod
    async def from_task_id(cls, data: "DataLayer", task_id: int):
        task = await data.tasks.get(task_id)
        temp_dir = await run_in_thread(get_temp_dir)
        return cls(task_id, data, task.context, temp_dir)

    @property
    def step_number(self):
        """
        The number of the active step.

        """
        if self.step is None:
            return 0

        return self.steps.index(self.step)

    async def run(self):
        """
        Run the task.

        """

        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await self.data.tasks.update(
                self.task_id, TaskUpdate(step=self.step.__name__)
            )

            logger.info("Starting task step '%s.%s'", self.task_type, func.__name__)

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
            round(
                100
                * (
                    self.step_number / (len(self.steps))
                    + (progress * (1 / len(self.steps)))
                )
            )
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


class UpdateRemoteReferenceTask(Task2):
    async def step_1(self):
        progress_handler = AbstractProgressHandler()

        await self.data.reference.update_remote_reference(ref_id, progress_handler)


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
                self.id, step=self.step.__name__
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
