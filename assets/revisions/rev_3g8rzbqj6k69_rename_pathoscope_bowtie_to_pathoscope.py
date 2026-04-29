"""Rename the legacy ``pathoscope_bowtie`` workflow to ``pathoscope``.

Backfills three stores so that the ``pathoscope_bowtie`` shims can be removed
from the codebase:

- PostgreSQL ``jobs.workflow``
- PostgreSQL ``users.settings->>'quick_analyze_workflow'`` (JSONB)
- MongoDB ``analyses.workflow``

Idempotent: only rows still holding ``pathoscope_bowtie`` are touched, so a
second run is a no-op.

Revision ID: 3g8rzbqj6k69
Date: 2026-04-29 22:40:02.765740
"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

name = "rename pathoscope bowtie to pathoscope"
created_at = arrow.get("2026-04-29 22:40:02.765740")
revision_id = "3g8rzbqj6k69"

alembic_down_revision = None
virtool_down_revision = "g2cecswiq3r2"

required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as session:
        jobs_result = await session.execute(
            text(
                "UPDATE jobs SET workflow = 'pathoscope' "
                "WHERE workflow = 'pathoscope_bowtie'",
            ),
        )
        users_result = await session.execute(
            text(
                "UPDATE users "
                "SET settings = jsonb_set("
                "settings, '{quick_analyze_workflow}', '\"pathoscope\"'::jsonb"
                ") "
                "WHERE settings->>'quick_analyze_workflow' = 'pathoscope_bowtie'",
            ),
        )
        await session.commit()

    analyses_result = await ctx.mongo.analyses.update_many(
        {"workflow": "pathoscope_bowtie"},
        {"$set": {"workflow": "pathoscope"}},
    )

    logger.info(
        "renamed pathoscope_bowtie to pathoscope",
        jobs=jobs_result.rowcount,
        users=users_result.rowcount,
        analyses=analyses_result.modified_count,
    )
