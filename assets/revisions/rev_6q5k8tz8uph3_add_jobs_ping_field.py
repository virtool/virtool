"""Add jobs ping field

Revision ID: 6q5k8tz8uph3
Date: 2022-10-07 20:14:53.735862

"""

import arrow

from virtool.migration import MigrationError
from virtool.migration.ctx import MigrationContext

# Revision identifiers.
name = "Add jobs ping field"
created_at = arrow.get("2022-10-07 20:14:53.735862")
revision_id = "6q5k8tz8uph3"

alembic_down_revision = None
virtool_down_revision = "i0ljixkr0wxg"


async def upgrade(ctx: MigrationContext) -> None:
    await ctx.mongo.jobs.update_many(
        {"ping": {"$exists": False}},
        {"$set": {"ping": None}},
    )

    if await ctx.mongo.jobs.count_documents({"ping": {"$exists": False}}):
        raise MigrationError("Some jobs still do not have a ping field")
