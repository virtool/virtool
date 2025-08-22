import shutil
from pathlib import Path

from syrupy import SnapshotAssertion

from virtool.workflow import RunSubprocess
from virtool.workflow.analysis.fastqc import (
    fastqc,
)


async def test_fastqc_paired(
    example_path: Path,
    run_subprocess: RunSubprocess,
    snapshot: SnapshotAssertion,
    work_path: Path,
):
    shutil.copyfile(
        example_path / "sample/reads_1.fq.gz",
        work_path / "reads_1.fq.gz",
    )

    shutil.copyfile(
        example_path / "sample/reads_2.fq.gz",
        work_path / "reads_2.fq.gz",
    )

    func = await fastqc(run_subprocess)

    result = await func(
        (
            work_path / "reads_1.fq.gz",
            work_path / "reads_2.fq.gz",
        ),
    )

    assert result == snapshot


async def test_fastqc_unpaired(
    example_path: Path,
    run_subprocess: RunSubprocess,
    snapshot: SnapshotAssertion,
    work_path: Path,
):
    shutil.copyfile(
        example_path / "sample/reads_1.fq.gz",
        work_path / "reads_1.fq.gz",
    )

    func = await fastqc(run_subprocess)

    result = await func(
        (work_path / "reads_1.fq.gz",),
    )

    assert result == snapshot
