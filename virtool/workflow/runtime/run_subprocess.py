"""Code for running and managing subprocesses."""

import asyncio
from asyncio.subprocess import Process
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Protocol

from pyfixtures import fixture
from structlog import get_logger

from virtool.utils import timestamp
from virtool.workflow.errors import SubprocessFailedError

logger = get_logger("subprocess")

# Constants
BUFFER_LIMIT = 1024 * 1024 * 128
EXIT_SUCCESS = 0
EXIT_TERMINATED = 15
EXIT_TERMINATED_NEG = -15


class LineOutputHandler(Protocol):
    """A protocol for handling subprocess output line by line."""

    async def __call__(self, line: bytes):
        """Handle input from stdin, or stderr, line by line.

        :param line: A line of output from the stream.
        """
        raise NotImplementedError


class RunSubprocess(Protocol):
    async def __call__(
        self,
        command: list[str],
        cwd: str | Path | None = None,
        env: dict[str, str] | None = None,
        stderr_handler: LineOutputHandler | None = None,
        stdout_handler: LineOutputHandler | None = None,
        timeout: float | None = None,
    ) -> Process:
        """Run a shell command in a subprocess.

        :param command: A shell command
        :param stdout_handler: A function to handle stdout output line by line
        :param stderr_handler: A function to handle stderr output line by line
        :param env: environment variables which should be available to the subprocess
        :param cwd: The current working directory
        :param timeout: Maximum time in seconds for subprocess execution
        :raise SubprocessFailed: The subprocess has exited with a non-zero exit code
        :return: An :class:`.Process` instance
        """
        raise NotImplementedError


async def watch_pipe(
    stream: asyncio.StreamReader,
    handler: LineOutputHandler,
) -> None:
    """Watch the stdout or stderr stream and pass lines to the handler function.

    :param stream: a stdout or stderr file object
    :param handler: a handler coroutine for output lines

    """
    while True:
        line = await stream.readline()

        if not line:
            return

        await handler(line)


def create_stderr_handler(
    stderr_handler: LineOutputHandler | None = None,
) -> LineOutputHandler:
    """Create a stderr handler that logs and optionally forwards to user handler."""

    async def _stderr_handler(line: bytes) -> None:
        """Handle stderr output line by line."""
        stderr_logger(line)
        if stderr_handler:
            await stderr_handler(line)

    return _stderr_handler


def stderr_logger(line: bytes) -> None:
    """Log a line of stderr output and try to decode it as UTF-8.

    If the line is not decodable, log it as a string representation.

    :param line: a line of stderr output
    """
    line = line.rstrip()

    try:
        decoded_line = line.decode("utf-8")
        logger.info("stderr", line=decoded_line)
    except UnicodeDecodeError:
        logger.info("stderr", line=repr(line))


async def _run_subprocess(
    command: list[str],
    stdout_handler: LineOutputHandler | None = None,
    stderr_handler: LineOutputHandler | None = None,
    env: dict[str, str] | None = None,
    cwd: str | Path | None = None,
    timeout: float | None = None,
) -> asyncio.subprocess.Process:
    """Run a process with logging and event integration to the workflow framework.

    Implements :class:`RunSubprocess` using `asyncio.subprocess`.
    """
    logger.info("running subprocess", command=command)

    stdout = asyncio.subprocess.PIPE if stdout_handler else asyncio.subprocess.DEVNULL
    _stderr_handler = create_stderr_handler(stderr_handler)

    process = await asyncio.create_subprocess_exec(
        *(str(arg) for arg in command),
        cwd=cwd,
        env=env,
        limit=BUFFER_LIMIT,
        stderr=asyncio.subprocess.PIPE,
        stdout=stdout,
    )

    logger.info(
        "started subprocess", pid=process.pid, timestamp=timestamp().isoformat()
    )

    aws = [watch_pipe(process.stderr, _stderr_handler)]

    if stdout_handler:
        aws.append(watch_pipe(process.stdout, stdout_handler))

    watcher_future = asyncio.gather(*aws)

    try:
        if timeout:
            await asyncio.wait_for(watcher_future, timeout=timeout)
        else:
            await watcher_future
    except (asyncio.CancelledError, asyncio.TimeoutError):
        logger.info("terminating subprocess")

        process.terminate()

        await process.wait()
        logger.info("subprocess exited", code=process.returncode)

        await watcher_future

        return process

    await process.wait()

    # Exit code 15 indicates that the process was terminated. This is expected
    # when the workflow fails for some other reason, hence not an exception
    if process.returncode not in [EXIT_SUCCESS, EXIT_TERMINATED, EXIT_TERMINATED_NEG]:
        raise SubprocessFailedError(
            command=command,
            return_code=process.returncode,
        )

    logger.info(
        "subprocess finished",
        return_code=process.returncode,
        timestamp=timestamp().isoformat(),
    )

    return process


@fixture(protocol=RunSubprocess)
def run_subprocess() -> RunSubprocess:
    """Fixture to run subprocesses and handle stdin and stderr output line-by-line."""
    return _run_subprocess
