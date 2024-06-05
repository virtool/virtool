"""
deduplicate sample names

Revision ID: zma2wj6b39hs
Date: 2024-06-05 17:07:52.959084

"""

from datetime import timedelta

import arrow
import pytest
from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "deduplicate sample names"
created_at = arrow.get("2024-06-05 17:07:52.959084")
revision_id = "zma2wj6b39hs"

alembic_down_revision = "None"
virtool_down_revision = "uejy8b1tlmvv"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


class NameGenerator:
    """Generates unique incrementing sample names based on a base name and a space
    id.
    """

    def __init__(self, mongo: "Mongo", base_name: str, space_id: str):
        self.base_name = base_name
        self.space_id = space_id
        self.db = mongo
        self.sample_number = 1

    async def get(self):
        self.sample_number += 1

        while await self.db.samples.count_documents(
            {
                "name": f"{self.base_name} ({self.sample_number})",
                "space_id": self.space_id,
            },
            limit=1,
        ):
            self.sample_number += 1

        return f"{self.base_name} ({self.sample_number})"


async def upgrade(ctx: MigrationContext):

    async for duplicate_name_documents in ctx.mongo.samples.aggregate(
        [
            {
                "$group": {
                    "_id": {"name": "$name", "space_id": "$space_id"},
                    "count": {"$sum": 1},
                    "documents": {
                        "$push": {"_id": "$_id", "created_at": "$created_at"},
                    },
                },
            },
            {"$match": {"count": {"$gt": 1}}},
            {"$unwind": "$documents"},
            {"$sort": {"documents.created_at": 1}},
            {
                "$group": {
                    "_id": "$_id",
                    "sample_ids": {"$push": "$documents._id"},
                },
            },
            {
                "$project": {
                    "name": "$_id.name",
                    "space_id": "$_id.space_id",
                    "_id": 0,
                    "sample_ids": 1,
                },
            },
        ],
    ):
        name_generator = NameGenerator(
            ctx.mongo,
            duplicate_name_documents["name"],
            duplicate_name_documents.get("space_id", None),
        )

        for sample_id in duplicate_name_documents["sample_ids"][1:]:
            await ctx.mongo.samples.update_one(
                {"_id": sample_id},
                {"$set": {"name": await name_generator.get()}},
            )


@pytest.mark.parametrize("spaces", [True, False])
async def test_upgrade(
    ctx: MigrationContext,
    snapshot,
    static_time,
    spaces,
):
    samples = [
        {
            "_id": "test_id",
            "name": "test_name",
            "created_at": static_time.datetime,
            "space_id": "0",
        },
        {
            "_id": "test_id_2",
            "name": "test_name (2)",
            "created_at": static_time.datetime + timedelta(days=3),
            "space_id": "0",
        },
        {
            "_id": "test_id_3",
            "name": "test_name",
            "created_at": static_time.datetime + timedelta(days=2),
            "space_id": "0",
        },
        {
            "_id": "test_id_4",
            "name": "test_name",
            "created_at": static_time.datetime + timedelta(days=1),
            "space_id": "1",
        },
    ]

    if not spaces:
        for sample in samples:
            sample.pop("space_id")

    await ctx.mongo.samples.insert_many(samples)

    await upgrade(ctx)

    assert await ctx.mongo.samples.find().to_list(None) == snapshot
