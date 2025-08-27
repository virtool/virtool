"""Tools for workflows relating to sequence analysis."""

from collections.abc import Callable
from pathlib import Path

type ReadPaths = tuple[Path] | tuple[Path, Path]
"""A tuple of paths to FASTQ files.

There may be one or two paths, depending on whether the dataset is paired.
"""


def _make_paired_paths(
    dir_path: Path, paired: bool, mkstr: Callable[[int], str]
) -> ReadPaths:
    path_1 = dir_path / mkstr(1)
    return (path_1, dir_path / mkstr(2)) if paired else (path_1,)


def make_read_paths(reads_dir_path: Path, paired: bool) -> ReadPaths:
    """Get the path(s) locating the compressed fastq files containing the read data.

    :param reads_dir_path: the directory containing the fastq file(s).
    :param paired: a boolean indicating if the sequence is paired.
    :return: the paths
    """
    return _make_paired_paths(reads_dir_path, paired, lambda n: f"reads_{n}.fq.gz")
