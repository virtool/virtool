"""
ensure notes and labels fields in sample documents

Revision ID: wo0wk22ngsgn
Date: 2024-06-05 15:54:12.149912

"""

import arrow
from virtool.migration import MigrationContext

# Revision identifiers.
name = "ensure notes and labels fields in sample documents"
created_at = arrow.get("2024-06-05 15:54:12.149912")
revision_id = "wo0wk22ngsgn"

alembic_down_revision = None
virtool_down_revision = "uejy8b1tlmvv"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    await ctx.mongo.samples.update_many(
        {"notes": {"$exists": False}},
        {
            "$set": {
                "notes": "",
            }
        },
    )

    await ctx.mongo.samples.update_many(
        {"labels": {"$exists": False}},
        {
            "$set": {
                "labels": [],
            }
        },
    )


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.samples.insert_many(
        [
            {
                "_id": "sample_1",
                "labels": [1, 2],
                "name": "has_both",
                "notes": "existing notes",
            },
            {"_id": "sample_2", "labels": [3, 4], "name": "has_labels"},
            {"_id": "sample_3", "name": "has_notes", "notes": "only has notes"},
            {"_id": "sample_4", "name": "has_neither"},
        ]
    )

    assert [sample async for sample in ctx.mongo.samples.find({})] == snapshot(
        name="before"
    )

    await upgrade(ctx)

    assert [sample async for sample in ctx.mongo.samples.find({})] == snapshot(
        name="after"
    )
