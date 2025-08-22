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


class LineOutputHandler(Protocol):
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
        env: dict | None = None,
        stderr_handler: LineOutputHandler | None = None,
        stdout_handler: LineOutputHandler | None = None,
    ) -> Process:
        """Run a shell command in a subprocess.

        :param command: A shell command
        :param stdout_handler: A function to handle stdout output line by line
        :param stderr_handler: A function to handle stderr output line by line
        :param env: environment variables which should be available to the subprocess
        :param cwd: The current working directory
        :raise SubprocessFailed: The subprocess has exited with a non-zero exit code
        :return: An :class:`.Process` instance
        """
        raise NotImplementedError


async def watch_pipe(
    stream: asyncio.StreamReader,
    handler: LineOutputHandler,
):
    """Watch the stdout or stderr stream and pass lines to the `handler` callback function.

    :param stream: a stdout or stderr file object
    :param handler: a handler coroutine for output lines

    """
    while True:
        line = await stream.readline()

        if not line:
            return

        await handler(line)


def stderr_logger(line: bytes):
    """Log a line of stderr output and try to decode it as UTF-8.

    If the line is not decodable, log it as a string.

    :param line: a line of stderr output
    """
    line = line.rstrip()

    try:
        logger.info("stderr", line=line.decode())
    except UnicodeDecodeError:
        logger.info("stderr", line=line)


async def _run_subprocess(
    command: list[str],
    stdout_handler: LineOutputHandler | None = None,
    stderr_handler: Callable[[str], Coroutine] | None = None,
    env: dict | None = None,
    cwd: str | None = None,
) -> asyncio.subprocess.Process:
    """An implementation of :class:`RunSubprocess` using `asyncio.subprocess`."""
    log = logger.bind()
    log.info("running subprocess", command=command)

    stdout = asyncio.subprocess.PIPE if stdout_handler else asyncio.subprocess.DEVNULL

    if stderr_handler:

        async def _stderr_handler(line):
            stderr_logger(line)
            await stderr_handler(line)

    else:

        async def _stderr_handler(line):
            stderr_logger(line)

    process = await asyncio.create_subprocess_exec(
        *(str(arg) for arg in command),
        cwd=cwd,
        env=env,
        limit=1024 * 1024 * 128,
        stderr=asyncio.subprocess.PIPE,
        stdout=stdout,
    )

    log.info("started subprocess", pid=process.pid, timestamp=timestamp().isoformat())

    aws = [watch_pipe(process.stderr, _stderr_handler)]

    if stdout_handler:
        aws.append(watch_pipe(process.stdout, stdout_handler))

    watcher_future = asyncio.gather(*aws)

    try:
        await watcher_future
    except asyncio.CancelledError:
        logger.info("terminating subprocess")

        process.terminate()

        # Have to do this in Python 3.10 to avoid Event loop closed error.
        # https://github.com/python/cpython/issues/88050
        try:
            process._transport.close()
        except AttributeError:
            pass

        await process.wait()
        logger.info("subprocess exited", code=process.returncode)

        await watcher_future

        return process

    await process.wait()

    # Exit code 15 indicates that the process was terminated. This is expected
    # when the workflow fails for some other reason, hence not an exception
    if process.returncode not in [0, 15, -15]:
        raise SubprocessFailedError(
            f"{command[0]} failed with exit code {process.returncode}\n"
            f"arguments: {command}\n",
        )

    log.info(
        "subprocess finished",
        return_code=process.returncode,
        timestamp=timestamp().isoformat(),
    )

    return process


@fixture(protocol=RunSubprocess)
def run_subprocess() -> RunSubprocess:
    """Fixture to run subprocesses and handle stdin and stderr output line-by-line."""
    return _run_subprocess
