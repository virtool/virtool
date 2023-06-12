import datetime
from logging import getLogger
from pathlib import Path

import arrow
from alembic.util import load_python_file

from virtool.migration.cls import Revision, GenericRevision, RevisionSource

logger = getLogger("migration")


def get_alembic_path() -> Path:
    """Get the path to the alembic directory."""
    return Path(__file__).parent.parent.parent / "assets/alembic/versions"


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


def load_alembic_revisions() -> list[GenericRevision]:
    """Load all alembic revisions."""
    revisions = []

    for path in get_alembic_path().iterdir():
        if path.suffix == ".py":
            module = load_python_file(str(path.parent), str(path.name))

            revisions.append(
                GenericRevision(
                    id=getattr(module, "revision"),
                    created_at=get_revision_create_date(path),
                    name=get_revision_name(path),
                    source=RevisionSource.ALEMBIC,
                    depends_on=None,
                    upgrade=None,
                )
            )

    return revisions


def load_virtool_revisions() -> list[GenericRevision]:
    """
    Load all virtool revisions as generic revisions.

    This is used to interleave Virtool revisions with Alembic revisions.

    :return: a list of generic revisions
    """
    revisions = load_revisions(Path(__file__).parent.parent.parent / "assets/revisions")

    return [
        GenericRevision(
            id=revision.id,
            created_at=revision.created_at,
            name=revision.name,
            source=RevisionSource.VIRTOOL,
            depends_on=revision.depends_on,
            upgrade=revision.upgrade,
        )
        for revision in revisions
    ]


def load_revisions(revisions_path: Path) -> list[Revision]:
    """
    Load revision modules and sort by creation date.

    :param revisions_path: the path to the revisions directory
    :returns: a list of revisions sorted by creation date
    """
    revisions = []

    for module_path in revisions_path.iterdir():
        if module_path.suffix == ".py":
            module = load_python_file(str(module_path.parent), str(module_path.name))

            revisions.append(
                Revision(
                    id=getattr(module, "revision_id"),
                    created_at=arrow.get(getattr(module, "created_at"))
                    .floor("second")
                    .naive,
                    name=getattr(module, "name"),
                    upgrade=getattr(module, "upgrade"),
                    depends_on=getattr(module, "required_alembic_revision"),
                )
            )

    revisions.sort(key=lambda r: r.created_at)

    logger.info("Found %s revisions", len(revisions))

    return revisions


def show_revisions():
    """Show all available revisions."""
    all_revisions = sorted(
        [*load_alembic_revisions(), *load_virtool_revisions()],
        key=lambda r: r.created_at,
    )

    print(f"Found {len(all_revisions)} revisions\n")
    print("Date\t\t", "ID\t", "Source", "Name", sep="\t")

    for revision in all_revisions:
        print(
            arrow.get(revision.created_at).format("YYYY-MM-DD HH:mm:ss"),
            revision.id,
            revision.source.value,
            revision.name,
            sep="\t",
        )
