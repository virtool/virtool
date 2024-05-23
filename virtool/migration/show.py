from typing import NamedTuple

import arrow
from alembic.util import load_python_file
from structlog import get_logger

from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.utils import (
    get_alembic_path,
    get_revision_create_date,
    get_revision_name,
    get_virtool_revisions_path,
)

logger = get_logger("migration")


class DowngradeSpecifier(NamedTuple):
    """A downgrade specifier for a revision."""

    #: The revision id of the downgrade.
    downgrade: str
    #: The downgrade revision source.
    downgrade_source: RevisionSource
    #: The source of the revision depending on the downgrade.
    dependent_source: RevisionSource


def load_alembic_revisions() -> list[GenericRevision]:
    """Load all Alembic revisions."""
    revisions = []

    for path in get_alembic_path().iterdir():
        if path.suffix == ".py":
            module = load_python_file(str(path.parent), str(path.name))

            revisions.append(
                GenericRevision(
                    alembic_downgrade=getattr(module, "down_revision", None),
                    created_at=get_revision_create_date(path),
                    id=module.revision,
                    name=get_revision_name(path),
                    source=RevisionSource.ALEMBIC,
                    upgrade=None,
                    virtool_downgrade=None,
                ),
            )

    return revisions


def load_virtool_revisions() -> list[GenericRevision]:
    """Load all Virtool revisions.

    This is used to interleave Virtool revisions with Alembic revisions.

    :return: a list of revisions
    """
    revisions = []

    for module_path in get_virtool_revisions_path().iterdir():
        if module_path.suffix == ".py" and module_path.stem.startswith("rev_"):
            module = load_python_file(str(module_path.parent), str(module_path.name))

            revisions.append(
                GenericRevision(
                    alembic_downgrade=module.alembic_down_revision,
                    created_at=arrow.get(module.created_at).floor("second").naive,
                    id=module.revision_id,
                    name=module.name,
                    source=RevisionSource.VIRTOOL,
                    upgrade=module.upgrade,
                    virtool_downgrade=module.virtool_down_revision,
                ),
            )

    return revisions


def order_revisions(revisions: list[GenericRevision]) -> list[GenericRevision]:
    """Order a list of revisions by their dependencies.

    :param revisions: the revisions to order
    :return: the ordered revisions
    :raises ValueError: if there are no root revisions
    """
    revisions_by_downgrade: dict[DowngradeSpecifier, GenericRevision] = {}

    ordered_revisions = []

    for revision in revisions:
        if revision.alembic_downgrade and revision.virtool_downgrade:
            raise ValueError(
                f"Revision {revision.id} has both an Alembic and Virtool downgrade.",
            )

        if revision.alembic_downgrade:
            revisions_by_downgrade[
                DowngradeSpecifier(
                    revision.alembic_downgrade,
                    RevisionSource.ALEMBIC,
                    revision.source,
                )
            ] = revision

        elif revision.virtool_downgrade:
            # Only Virtool revisions have Virtool downgrades.
            revisions_by_downgrade[
                DowngradeSpecifier(
                    revision.virtool_downgrade,
                    RevisionSource.VIRTOOL,
                    revision.source,
                )
            ] = revision

        else:
            ordered_revisions.append(revision)

    if len(ordered_revisions) == 0:
        raise ValueError("No root revision found.")

    if len(ordered_revisions) > 1:
        raise ValueError("Multiple root revisions found.")

    if ordered_revisions[0].source == RevisionSource.VIRTOOL:
        # The first revision must currently be an Alembic revision. The only way this
        # wiill change is if we add historical revisions prior to the one that is
        # currently first.
        raise ValueError("Root revision is not an Alembic revision.")

    last_seen_alembic_revision = ordered_revisions[0]

    while True:
        current = ordered_revisions[-1]

        # First, check for a Virtool revision.
        #
        # It is possible that an Alembic revision has the same downgrade as a Virtool
        # revision. This is a result of reading the downgrade ids from the Alembic
        # revisions. In reality, we want Virtool downgrades to take precedence over
        # Alembic downgrades.
        try:
            next_revision = revisions_by_downgrade.pop(
                DowngradeSpecifier(current.id, current.source, RevisionSource.VIRTOOL),
            )
        except KeyError:
            next_revision = None

        # If there is no next Virtool revision, we are looking for either another
        # Alembic revision or we are done.
        #
        # We know the next Alembic revision if it's downgrade id points to the last seen
        # Alembic revision.
        if next_revision is None:
            try:
                next_revision = revisions_by_downgrade.pop(
                    DowngradeSpecifier(
                        last_seen_alembic_revision.id,
                        RevisionSource.ALEMBIC,
                        RevisionSource.ALEMBIC,
                    ),
                )

                last_seen_alembic_revision = next_revision
            except KeyError:
                break

        ordered_revisions.append(next_revision)

    return ordered_revisions


def load_all_revisions() -> list[GenericRevision]:
    """Load Virtool and Alembic revisions.

    The returned list is sorted by dependency. A revision in the list is dependent on
    the previous revision. The first revision in the list has no dependencies.

    """
    return order_revisions([*load_alembic_revisions(), *load_virtool_revisions()])


def show_revisions():
    """Show all available revisions."""
    all_revisions = load_all_revisions()

    logger.info("Found revisions", count=len(all_revisions))

    for revision in all_revisions:
        logger.info(
            "Found revision",
            id=revision.id,
            name=revision.name,
            date=arrow.get(revision.created_at).format("YYYY-MM-DD HH:mm:ss"),
            source=revision.source.value,
        )
