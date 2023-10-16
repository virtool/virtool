from pathlib import Path
from random import choice
from string import ascii_lowercase, digits

import arrow
from alembic.util import load_python_file, template_to_file
from structlog import get_logger

from virtool.migration.cls import RevisionSource
from virtool.migration.show import load_all_revisions
from virtool.migration.utils import (
    get_revisions_path,
    get_template_path,
    derive_revision_filename,
)

logger = get_logger("migration")


def create_revision(name: str):
    """
    Create a new Virtool revision.

    The revision will be created at ``./assets/revisions``. It will automatically have
    its downgrades set to the last created revision.

    """
    revisions_path = get_revisions_path()

    most_recent_revision = load_all_revisions()[0]

    revision_id = _generate_revision_id(_get_existing_revisions(revisions_path))

    alembic_down_revision = (
        most_recent_revision.id
        if most_recent_revision.source == RevisionSource.ALEMBIC
        else None
    )

    virtool_down_revision = (
        most_recent_revision.id
        if most_recent_revision.source == RevisionSource.VIRTOOL
        else None
    )

    template_to_file(
        str(get_template_path() / "revision.py.mako"),
        str(revisions_path / derive_revision_filename(revision_id, name)),
        "utf-8",
        alembic_down_revision=alembic_down_revision,
        created_at=arrow.utcnow().naive,
        name=name,
        revision_id=revision_id,
        virtool_down_revision=virtool_down_revision,
    )

    logger.info("Created empty revision", name=name, id=revision_id)

    return revision_id


def _generate_revision_id(excluded: list[str]):
    """
    Generate a random revision id.

    :param excluded: the list of ids that should be excluded from the results
    :return: a revision id
    """
    characters = digits + ascii_lowercase

    candidate = "".join([choice(characters) for _ in range(12)])

    if candidate in excluded:
        return _generate_revision_id(excluded)

    return candidate


def _get_existing_revisions(revisions_path: Path) -> list[str]:
    """
    List all migration revisions in a revisions directory.
    """
    revisions = []

    try:
        for revision_path in revisions_path.iterdir():
            if revision_path.suffix == ".py" and revisions_path.stem.startswith("rev_"):
                with open(revision_path):
                    module = load_python_file(
                        str(revision_path.parent), str(revision_path.name)
                    )
                    revisions.append(getattr(module, "revision_id"))
    except FileNotFoundError:
        revisions_path.mkdir(parents=True)
        return _get_existing_revisions(revisions_path)

    return revisions
