"""
Fart1

Revision ID: zqipm7gmouqu
Date: 2023-04-14 19:16:07.859332

"""
import arrow

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Fart1"
created_at = arrow.get("2023-04-14 19:16:07.859332")
revision_id = "zqipm7gmouqu"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    ...
