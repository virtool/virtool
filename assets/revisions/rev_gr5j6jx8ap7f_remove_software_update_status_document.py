"""Remove software_update status document

Revision ID: gr5j6jx8ap7f
Date: 2022-06-09 22:20:48.591743

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "Remove software_update status document"
created_at = arrow.get("2022-06-09 22:20:48.591743")
revision_id = "gr5j6jx8ap7f"

alembic_down_revision = None
virtool_down_revision = "1p681ke9wedv"


async def upgrade(ctx: MigrationContext) -> None:
    async with (
        await ctx.mongo.client.start_session() as session,
        session.start_transaction(),
    ):
        await ctx.mongo.status.delete_many(
            {"_id": {"$in": ["software", "software_update", "version"]}},
            session=session,
        )
