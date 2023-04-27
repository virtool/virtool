from logging import getLogger
from pathlib import Path
from subprocess import call

import arrow
from alembic.util import load_python_file

from virtool.migration.cls import Revision
from virtool.migration.ctx import MigrationContext
from virtool.migration.model import SQLRevision

logger = getLogger("migration")


# async def apply(config: MigrationConfig, revision_id: str):
#     """
#     Apply revisions up to a given revision_id, ``to``.
#
#     Providing ``'latest'`` as for ``to`` will apply all required revisions up to latest.
#
#     Applied revisions are recorded in the target database so already applied revisions
#     are not reapplied in subsequent migrations.
#
#     :param config: the configuration values for migration
#     :param revision_id: the revision_id to update to or 'latest'
#     """
#     logger.info("Applying all revisions")
#
#     ctx = await create_migration_context(config)
#
#     last_applied_revision = await fetch_last_applied_revision(ctx.pg)
#
#     for revision in load_revisions(get_revisions_path()):
#         if last_applied_revision is None or (
#             revision.created_at > last_applied_revision.created_at
#         ):
#             await apply_one_revision(ctx, revision)
#
#         if revision_id != "latest" and revision.id == revision_id:
#             break


async def apply_one_revision(ctx: MigrationContext, revision):
    """
    Apply a single revision to Virtool data sources.

    :param ctx: the migration context
    :param revision: the revision to apply
    """
    logger.info("Applying revision '%s'", revision.id)

    if revision.depends_on:
        call(["alembic", "upgrade", revision.id])

    async with ctx.revision_context() as revision_ctx:
        await revision.upgrade(revision_ctx)
        revision_ctx.pg.add(
            SQLRevision(
                applied_at=arrow.utcnow().naive,
                name=revision.name,
                revision=revision.id,
                created_at=revision.created_at,
            )
        )
        await revision_ctx.pg.commit()


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
