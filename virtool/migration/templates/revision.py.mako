"""
${name}

Revision ID: ${revision_id}
Date: ${created_at}

"""
import arrow
from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "${name}"
created_at = arrow.get("${created_at}")
revision_id = "${revision_id}"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    ...
