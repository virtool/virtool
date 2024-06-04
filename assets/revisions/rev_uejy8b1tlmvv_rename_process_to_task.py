"""
rename process to task

Revision ID: uejy8b1tlmvv
Date: 2024-06-04 16:52:09.648183

"""

import arrow
from virtool.migration import MigrationContext

# Revision identifiers.
name = "rename process to task"
created_at = arrow.get("2024-06-04 16:52:09.648183")
revision_id = "uejy8b1tlmvv"

alembic_down_revision = None
virtool_down_revision = "t05gnq2g81qz"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.references.update_many(
        {"process": {"$exists": True}}, {"$rename": {"process": "task"}}
    )
    await ctx.mongo.references.update_many(
        {"task": {"$exists": False}}, {"$set": {"task": None}}
    )

    await ctx.mongo.status.update_one(
        {"_id": "hmm", "process": {"$exists": True}}, {"$rename": {"process": "task"}}
    )


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.references.insert_many(
        [
            {"_id": "ref_needs_migration", "process": {"id": "process_id"}},
            {"_id": "ref_no_proccess"},
            {"_id": "ref_already migrated", "task": {"id": "task_id"}},
        ]
    )

    await ctx.mongo.status.insert_many(
        [
            {"_id": "hmm", "process": {"id": "process_id"}},
            {"_id": "no_upgrade", "process": {"id": "process_id"}},
        ]
    )

    assert [reference async for reference in ctx.mongo.references.find()] == snapshot

    await upgrade(ctx)

    assert [reference async for reference in ctx.mongo.references.find()] == snapshot

    assert [status async for status in ctx.mongo.status.find()] == snapshot
