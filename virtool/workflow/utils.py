"""Workflow utilities."""

from pathlib import Path


def get_workflow_version() -> str:
    """Get the version of the active workflow."""
    try:
        with Path("VERSION").open() as f:
            return f.read().strip()
    except FileNotFoundError:
        return "UNKNOWN"
