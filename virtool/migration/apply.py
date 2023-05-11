from logging import getLogger
from subprocess import call

import arrow

from virtool.config.cls import MigrationConfig
from virtool.migration.cls import RevisionSource
from virtool.migration.ctx import MigrationContext, create_migration_context
from virtool.migration.model import SQLRevision
from virtool.migration.pg import fetch_last_applied_revision, list_applied_revision_ids
from virtool.migration.show import load_alembic_revisions, load_virtool_revisions


logger = getLogger("migration")


async def apply(config: MigrationConfig, revision_id: str):
    """
    Apply revisions up to a given revision_id, ``to``.

    Providing ``'latest'`` as for ``to`` will apply all required revisions up to latest.

    Applied revisions are recorded in the target database so already applied revisions
    are not reapplied in subsequent migrations.

    :param config: the configuration values for migration
    :param revision_id: the revision_id to update to or 'latest'
    """

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
