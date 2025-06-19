"""
${name}

Revision ID: ${revision_id}
Date: ${created_at}

"""
import arrow
from virtool.migration import MigrationContext

# Revision identifiers.
name = "${name}"
created_at = arrow.get("${created_at}")
revision_id = "${revision_id}"

alembic_down_revision = ${"None" if alembic_down_revision is None else '"' + alembic_down_revision + '"'}
virtool_down_revision = ${"None" if virtool_down_revision is None else '"' + virtool_down_revision + '"'}

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    ...
