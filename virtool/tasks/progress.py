from abc import ABC, abstractmethod
from typing import Awaitable, Callable


class AbstractProgressHandler(ABC):
    @abstractmethod
    async def set_error(self, error: str):
        ...

    @abstractmethod
    async def set_progress(self, progress: int):
        ...


class TaskProgressHandler(AbstractProgressHandler):
    def __init__(
        self,
        set_error: Callable[[str], Awaitable],
        set_progress: Callable[
            [int],
            Awaitable,
        ],
    ):
        self._set_error = set_error
        self._set_progress = set_progress
        self._progress = 0

    async def set_error(self, error: str):
        """
        Put the calling task into an error state and provide and ``error`` string.
        """
        await self._set_error(error)

    async def set_progress(self, progress: int):
        """
        Update the tasks progress with the progress of the current subtask
        """

        if progress < self._progress:
            raise ValueError("Progress cannot decrease")

        if progress > self._progress:
            await self._set_progress(progress)

        self._progress = progress


class AccumulatingProgressHandlerWrapper:
    """
    Reports progress in a file download to a ``AbstractProgressHandler``.

    """

    def __init__(
        self,
        progress_handler: AbstractProgressHandler,
        total: int,
    ):
        self._progress_handler = progress_handler
        self._total = total
        self._accumulated = 0

    async def add(self, value: int):
        """
        Add a number of bytes onto the download handler and report progress.

        """
        self._accumulated += value

        await self._progress_handler.set_progress(
            round(self._accumulated * 100 / self._total)
        )
