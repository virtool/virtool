from dataclasses import dataclass
from pathlib import Path


@dataclass
class FileDescriptor:
    """Describes a file in the Virtool application data directory."""

    #: The path to the file in the application data directory.
    path: Path

    #: The file size in bytes.
    size: int
