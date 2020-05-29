"""
Classes, exceptions, and utilities for creating Virtool jobs.

"""
import asyncio
import asyncio.events
import concurrent.futures.thread
import logging
import signal
import subprocess
import sys
import tempfile
import traceback
from typing import Optional

import virtool.db.mongo
import virtool.db.utils
import virtool.jobs.agent
import virtool.jobs.db
import virtool.redis
import virtool.settings.db
import virtool.utils

logger = logging.getLogger(__name__)


class Job:

    def __init__(self):
        #: A `dict` of application settings passed into the job when it was created.
        self.settings = None

        self.on_startup = list()
        self.on_cleanup = list()

        self.params = dict()
        self.steps = list()
        self.intermediate = dict()
        self.results = dict()

        self.id = None

        #: An instance of :class:`pymongo.database.Database` connected to the MongoDB database specified by
        #: :attr:`.db_connection_string` and :attr:`.db_name`. Value is ``None`` until :meth:`.init_db` is called.
        self.db = None

        #: The name of the job task (eg. `create_sample`). Value is ``None`` until :meth:`.init_db` is called.
        self.task_name = None

        #: Arguments attached to the job document by the API server. Value is ``None`` until :meth:`.init_db` is called.
        self.task_args = None

        #: The core limit for the job. Value is ``None`` until :meth:`.init_db` is called.
        self.proc = None

        #: The memory limit for the job. Value is ``None`` until :meth:`.init_db` is called.
        self.mem = None

        self.temp_dir = tempfile.TemporaryDirectory()
        self._progress = 0
        self._stage = None
        self._state = "waiting"
        self._error = None
        self._process = None
        self._executor = None

    async def run(self, db, config, job_id):
        logger.debug("Job run method called")

        self._executor = concurrent.futures.thread.ThreadPoolExecutor()

        set_signals()

        self.db = db
        self.settings = config
        self.id = job_id

        try:
            await self._connect_db()
            await self._startup()

            for coro in self.steps:
                await self._run_step(coro)

            self._progress = 1

            await self._add_status(state="complete")

        except TerminationError:
            await self._add_status(state="cancelled")

            if self._process:
                self._process.kill()

            await self._cleanup()

        except:
            self._error = handle_exception()
            await self._add_status(state="error")

            logger.exception("Encountered exception:")

            try:
                self._process.kill()
            except (AttributeError, ProcessLookupError):
                pass

            await self._cleanup()

        await self.run_in_executor(
            self.temp_dir.cleanup
        )

    async def run_in_executor(self, func, *args):
        return await asyncio.get_event_loop().run_in_executor(self._executor, func, *args)

    async def run_subprocess(
            self,
            command: list,
            stdout_handler=None,
            stderr_handler=None,
            env: Optional[dict] = None,
            cwd: Optional[str] = None
    ):
        logger.info(f"Running command in subprocess: {' '.join(command)}")

        if stdout_handler:
            stdout = subprocess.PIPE
        else:
            stdout = subprocess.DEVNULL

        if stderr_handler:
            async def _stderr_handler(line):
                await stderr_handler(line)
                logger.info(f"STDERR: {line.rstrip()}")
        else:
            async def _stderr_handler(line):
                logger.info(f"STDERR: {line.rstrip()}")

        self._process = await asyncio.create_subprocess_exec(
            *command,
            stdout=stdout,
            stderr=subprocess.PIPE,
            env=env,
            cwd=cwd
        )

        coros = [
            watch_pipe(self._process.stderr, _stderr_handler)
        ]

        if stdout_handler:
            coros.append(watch_pipe(self._process.stdout, stdout_handler))

        await asyncio.gather(*coros)
        await self._process.wait()

        if self._process.returncode != 0:
            raise SubprocessError(f"Command failed ({self._process.returncode}): {' '.join(command)}")

        self._process = None

    async def _run_step(self, coro):
        name = coro.__name__
        logger.info(f"Starting step: {name}")
        await self._add_status(stage=name, state="running")
        await coro(self)
        logger.info(f"Finished step: {name}")

    async def _connect_db(self):
        logger.info("Retrieving job document")

        document = await self.db.jobs.find_one(self.id)

        self.task_name = document["task"]
        self.task_args = document["args"]

        logger.info("Retrieving application settings")
        self.settings = {
            **self.settings,
            **await virtool.settings.db.get(self.db)
        }

        self.proc = self.settings["proc"]
        self.mem = self.settings["mem"]

    async def _startup(self):
        logger.info("Starting job")

        for coro in self.on_startup:
            await coro(self)

    async def _cleanup(self):
        logger.info(f"Cleaning up after job failure")

        for coro in self.on_cleanup:
            await coro(self)

    async def _add_status(self, state=None, stage=None):
        """
        Add a status entry to the job database document that describes this job.

        :param state:
        :param stage:
        :return:
        """

        self._state = state or self._state
        self._stage = stage or self._stage

        if self._stage and self._progress != 1:
            stage_index = [m.__name__ for m in self.steps].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self.steps) + 1), 2)

        await self.db.jobs.update_one({"_id": self.id}, {
            "$push": {
                "status": {
                    "state": self._state,
                    "stage": self._stage,
                    "error": self._error,
                    "progress": self._progress,
                    "timestamp": virtool.utils.timestamp()
                }
            }
        })


class SubprocessError(Exception):
    """
    This exception is raised when a subprocess run as part of a job encounters an error. The exception is handled in
    the main :meth:`.run` method

    """
    pass


class TerminationError(Exception):
    """
    This exception is raised when ``SIGTERM`` is handled in the job process. ``SIGTERM`` usually represents an attempt
    at cancellation of the job as a result of the process's :meth:`~multiprocessing.Process.terminate` being called.

    The exception is handled in the :meth:`.run` method and stops execution and leads the job into a cancelled state.

    """
    pass


def set_signals():
    # Prevent the signal from propagating to the main server process.
    # See: https://stackoverflow.com/questions/50781181/os-kill-vs-process-terminate-within-aiohttp
    signal.set_wakeup_fd(-1)

    # Ignore keyboard interrupts. The manager will deal with the signal and cancel jobs safely.
    signal.signal(signal.SIGINT, signal.SIG_IGN)

    # When the manager terminates jobs, run the handle_sigterm method.
    signal.signal(signal.SIGTERM, handle_sigterm)


def handle_exception(max_tb: Optional[int] = 50) -> dict:
    """
    Transforms an exception into a :class:`dict` describing the error. The dict can be stored in MongoDB and used to
    annotate a job document.

    Usage:

    .. code-block:: python

        try:
            cause_error()
        except:
            error = handle_exception()

    :param max_tb: maximum traceback depth
    :return: traceback data

    """
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(arg) for arg in value.args]
    }


def handle_sigterm(*args):
    """
    A handler for SIGTERM signals. Raises a TerminationError in :meth:`.Job.run` that allows the job to clean-up after
    itself before terminating.

    A SIGTERM is generally received as the result of explicit cancellation of the job by a user.

    """
    raise TerminationError


async def watch_pipe(stream: asyncio.StreamReader, handler):
    """
    A function for watching stdout and stderr pipes on subprocesses. Lines are read and pushed into the `q`. Queued
    lines are handled in :meth:`.Job.run`.

    This function is intended to be run in a separate thread.

    :param stream: a stdout or stderr file object
    :param handler: a handler coroutine for output lines

    """
    while True:
        line = await stream.readline()

        if not line:
            return

        await handler(line)
