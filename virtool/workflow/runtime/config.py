from dataclasses import dataclass
from pathlib import Path


@dataclass
class RunConfig:
    """The configuration for a workflow run."""

    dev: bool
    """Whether the workflow should run in development mode."""

    jobs_api_connection_string: str
    """The connection string for the jobs API."""

    mem: int
    """The memory limit for the workflow run."""
    proc: int
    """The number of processors available to the workflow run."""

    work_path: Path
    """The path to a directory where the workflow can store temporary files."""
