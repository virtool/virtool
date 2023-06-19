import datetime
from pathlib import Path

import arrow

from virtool.migration.cls import GenericRevision


def get_revisions_path() -> Path:
    """
    Get the hardcoded path to Virtool revision files.

    :return: the revisions path

    """
    return Path(__file__).parent.parent.parent / "assets/revisions"


def get_template_path() -> Path:
    """
    Get the hardcoded path to migration template files.

    :return: the template path

    """
    return Path(__file__).parent.parent.parent / "virtool/migration/templates"


def derive_revision_filename(revision_id: str, name: str) -> str:
    """
    Derive the revision filename from the id and name.

    :param revision_id: the revision id
    :param name: the revision name
    :return: the filename

    """
    transformed_name = name.lower().replace(" ", "_")
    return f"rev_{revision_id}_{transformed_name}.py"


def get_alembic_path() -> Path:
    """Get the path to the alembic directory."""
    return Path(__file__).parent.parent.parent / "assets/alembic/versions"


def get_virtool_revisions_path() -> Path:
    """Get the path to the Virtool revision directory."""
    return Path(__file__).parent.parent.parent / "assets/revisions"


def get_single_virtool_revision_path(revision: GenericRevision) -> Path:
    """Get the path to the Virtool revision directory."""
    return (
        Path(__file__).parent.parent.parent
        / "assets/revisions"
        / derive_revision_filename(revision.id, revision.name)
    )


def get_revision_create_date(path: Path) -> datetime.datetime:
    """Get the date the revision was created."""
    with open(path, "r") as f:
        for line in f:
            if line.startswith("Create Date:"):
                return arrow.get(line.replace("Create Date:", "").strip()).naive

    raise ValueError("Could not find create date")


def get_revision_name(path: Path) -> str:
    """Get the date the revision was created."""
    with open(path, "r") as f:
        for line in f:
            return line.replace('"""', "").strip()
