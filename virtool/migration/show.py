import datetime
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from subprocess import call
from typing import Callable, Awaitable

import arrow
from alembic.util import load_python_file

from virtool.config.cls import MigrationConfig
from virtool.migration.apply import apply_one_revision, load_revisions
from virtool.migration.ctx import create_migration_context, MigrationContext
from virtool.migration.pg import fetch_last_applied_revision, list_applied_revision_ids


class RevisionSource(str, Enum):
    """The source of a revision."""

    ALEMBIC = "alembic"
    VIRTOOL = "virtool"


@dataclass
class GenericRevision:
    id: str
    created_at: datetime.datetime
    name: str
    source: RevisionSource
    depends_on: str
    upgrade: Callable[[MigrationContext], Awaitable[None]]


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


async def apply(config: MigrationConfig, revision_id: str):

    all_revisions = sorted(
        [*load_alembic_revisions(), *load_virtool_revisions()],
        key=lambda r: r.created_at,
    )

    ctx = await create_migration_context(config)

    last_applied_revision = await fetch_last_applied_revision(ctx.pg)

    for revision in all_revisions:

        if revision.id in await list_applied_revision_ids(ctx.pg):
            continue

        if last_applied_revision is None or (
            revision.created_at > last_applied_revision.created_at
        ):

            if revision.source == RevisionSource.VIRTOOL:

                await apply_one_revision(ctx, revision)

            else:

                call(["alembic", "upgrade", revision.id])

        if revision_id != "latest" and revision.id == revision_id:
            break


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
