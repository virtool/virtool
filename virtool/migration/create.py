from logging import getLogger
from pathlib import Path
from random import choice
from string import ascii_lowercase, digits
from typing import List

import arrow
from alembic.util import load_python_file, template_to_file

from virtool.migration.utils import get_revisions_path

logger = getLogger("migration")


def create_revision(name: str):
    """
    Create a new data revision.

    """
    revisions_path = get_revisions_path()
    revisions_path.mkdir(
        exist_ok=True,
        parents=True,
    )

    revision_id = _generate_revision_id(_get_existing_revisions(revisions_path))

    now = arrow.utcnow()

    transformed_name = name.lower().replace(" ", "_")

    template_to_file(
        "virtool/migration/templates/revision.py.mako",
        str(revisions_path / f"rev_{now.format('YYMMDDHHmm')}_{transformed_name}.py"),
        "utf-8",
        name=name,
        revision_id=revision_id,
        created_at=now.naive,
    )

    print(f"Created empty revision '{name}' with id '{revision_id}'")

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


def _get_existing_revisions(revisions_path: Path) -> List[str]:
    """
    List all migration revisions in a revisions directory.
    """
    revisions = []

    try:
        for revision_path in revisions_path.iterdir():
            if revision_path.suffix == ".py":
                with open(revision_path):
                    module = load_python_file(
                        str(revision_path.parent), str(revision_path.name)
                    )
                    revisions.append(getattr(module, "revision_id"))
    except FileNotFoundError:
        revisions_path.mkdir(parents=True)
        return _get_existing_revisions(revisions_path)

    return revisions
