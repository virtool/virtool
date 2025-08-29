"""Dataclasses for describing files uploaded to the Virtool server."""

import datetime
from dataclasses import dataclass
from typing import Literal

VirtoolFileFormat = Literal[
    "sam",
    "bam",
    "fasta",
    "fastq",
    "csv",
    "tsv",
    "json",
    "unknown",
]
"""A literal type hint for the format of a :class:`.VirtoolFile`."""


@dataclass
class VirtoolFile:
    """A description of a file  uploaded to the Virtool server."""

    id: int
    """The unique ID for the file."""

    name: str
    """The name of the file."""

    size: int
    """The size of the file in bytes."""

    format: VirtoolFileFormat
    """The format of the file."""

    name_on_disk: str | None = None
    """The actual name of the file on disk."""

    uploaded_at: datetime.datetime | None = None
    """When the file was uploaded."""
