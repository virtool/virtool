import asyncio.subprocess
import gzip
import shutil
from pathlib import Path

from Bio import SeqIO

from virtool.workflow import RunSubprocess
from virtool.workflow.analysis.skewer import (
    SkewerConfiguration,
    SkewerMode,
    SkewerResult,
    skewer,
)


async def test_skewer_single(
    example_path: Path,
    run_subprocess: RunSubprocess,
    work_path: Path,
):
    func = skewer(
        1,
        run_subprocess,
    )

    input_path = work_path / "input"
    input_path.mkdir()

    shutil.copyfile(
        example_path / "sample" / "reads_1.fq.gz",
        input_path / "reads_1.fq.gz",
    )

    shutil.copyfile(
        example_path / "sample" / "reads_2.fq.gz",
        input_path / "reads_2.fq.gz",
    )

    result: SkewerResult = await func(
        SkewerConfiguration(
            max_error_rate=0.2,
            max_indel_rate=0.3,
            mode=SkewerMode.SINGLE_END,
            min_length=20,
            end_quality=20,
            mean_quality=30,
        ),
        (input_path / "reads_1.fq.gz",),
        work_path / "output",
    )

    assert result.output_path == work_path / "output"

    assert isinstance(result.process, asyncio.subprocess.Process)

    assert result.read_paths == (work_path / "output" / "reads_1.fq.gz",)
    assert result.left == work_path / "output" / "reads_1.fq.gz"
    assert result.right is None

    with gzip.open(example_path / "sample" / "trimmed_single.fq.gz", "rt") as f_example:
        example_fastq = SeqIO.to_dict(SeqIO.parse(f_example, "fastq"))

    with gzip.open(work_path / "output" / "reads_1.fq.gz", "rt") as f_result:
        for record in SeqIO.parse(f_result, "fastq"):
            from_example = example_fastq[record.id]

            assert record.id == from_example.id
            assert record.seq == from_example.seq


async def test_skewer_paired(
    example_path: Path,
    run_subprocess: RunSubprocess,
    work_path: Path,
):
    func = skewer(
        1,
        run_subprocess,
    )

    input_path = work_path / "input"
    input_path.mkdir()

    shutil.copyfile(
        example_path / "sample" / "reads_1.fq.gz",
        input_path / "reads_1.fq.gz",
    )

    shutil.copyfile(
        example_path / "sample" / "reads_2.fq.gz",
        input_path / "reads_2.fq.gz",
    )

    result: SkewerResult = await func(
        SkewerConfiguration(
            max_error_rate=0.2,
            max_indel_rate=0.3,
            mode=SkewerMode.PAIRED_END,
            min_length=20,
            end_quality=20,
            mean_quality=30,
        ),
        (input_path / "reads_1.fq.gz", input_path / "reads_2.fq.gz"),
        work_path / "output",
    )

    assert result.output_path == work_path / "output"

    assert isinstance(result.process, asyncio.subprocess.Process)

    assert result.read_paths == (
        work_path / "output" / "reads_1.fq.gz",
        work_path / "output" / "reads_2.fq.gz",
    )
    assert result.left == result.read_paths[0] == work_path / "output" / "reads_1.fq.gz"
    assert (
        result.right == result.read_paths[1] == work_path / "output" / "reads_2.fq.gz"
    )

    assert result.read_paths == (
        work_path / "output" / "reads_1.fq.gz",
        work_path / "output" / "reads_2.fq.gz",
    )

    for suffix in (1, 2):
        with gzip.open(
            example_path / "sample" / f"trimmed_{suffix}.fq.gz",
            "rt",
        ) as f_example:
            example_fastq = SeqIO.to_dict(SeqIO.parse(f_example, "fastq"))

        with gzip.open(
            work_path / "output" / f"reads_{suffix}.fq.gz",
            "rt",
        ) as f_result:
            for record in SeqIO.parse(f_result, "fastq"):
                from_example = example_fastq[record.id]

                assert record.id == from_example.id
                assert record.seq == from_example.seq
