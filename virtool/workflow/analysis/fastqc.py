"""Utilities and fixtures for running FastQC."""

import asyncio
import tempfile
from pathlib import Path
from typing import Protocol

from pyfixtures import fixture

from virtool.quality.fastqc import parse_fastqc
from virtool.quality.models import Quality
from virtool.workflow import RunSubprocess
from virtool.workflow.analysis.utils import ReadPaths


class FastQCRunner(Protocol):
    """A protocol describing callables that can be used to run FastQC."""

    async def __call__(self, paths: ReadPaths) -> Quality: ...


@fixture
async def fastqc(run_subprocess: RunSubprocess) -> FastQCRunner:
    """Provides an asynchronous function that can run FastQC as a subprocess.

    The function takes a one or two paths to FASTQ read files (:class:`.ReadPaths`) in
    a tuple.

    Example:
    -------
    .. code-block:: python

        @step
        async def step_one(fastqc: FastQCRunner, work_path: Path):
            fastqc_result = await fastqc((
                work_path / "reads_1.fq",
                work_path / "reads_2.fq"
            ))

    """
    temp_path = Path(await asyncio.to_thread(tempfile.mkdtemp))

    async def func(paths: ReadPaths) -> Quality:
        command = [
            "fastqc",
            "-f",
            "fastq",
            "-o",
            str(temp_path),
            "--extract",
            *[str(path) for path in paths],
        ]

        await run_subprocess(command)

        return parse_fastqc(temp_path)

    return func
