"""
Create all database indexes

Revision ID: l20h8fsbbb28
Date: 2023-01-31 00:56:11.597898

"""
import asyncio

import arrow
from pymongo import ASCENDING, DESCENDING, IndexModel

from virtool.migration.ctx import RevisionContext

# Revision identifiers.
name = "Create all database indexes"
created_at = arrow.get("2023-01-31 00:56:11.597898")
revision_id = "l20h8fsbbb28"
required_alembic_revision = None


async def upgrade(ctx: RevisionContext):
    """
    Create all database indexes.

    This was formerly done on application startup. It did not make sense to do this
    everytime the application started when new indexes are rarely introduced.
    """
    await ctx.mongo.database.analyses.create_indexes(
        [
            IndexModel([("sample.id", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ],
    )

    await ctx.mongo.database.groups.create_index(
        "name",
        unique=True,
        sparse=True,
    )

    await ctx.mongo.database.history.create_indexes(
        [
            IndexModel([("otu.id", ASCENDING)]),
            IndexModel([("index.id", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)]),
            IndexModel([("otu.name", ASCENDING)]),
            IndexModel([("otu.version", DESCENDING)]),
        ],
    )

    await ctx.mongo.database.indexes.create_index(
        [("version", ASCENDING), ("reference.id", ASCENDING)],
        unique=True,
    )

    await ctx.mongo.database.keys.create_indexes(
        [
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("user.id", ASCENDING)]),
        ],
    )

    await ctx.mongo.database.otus.create_indexes(
        [
            IndexModel([("_id", ASCENDING), ("isolate.id", ASCENDING)]),
            IndexModel([("name", ASCENDING)]),
            IndexModel([("nickname", ASCENDING)]),
            IndexModel([("abbreviation", ASCENDING)]),
            IndexModel([("reference.id", ASCENDING), ("remote.id", ASCENDING)]),
        ],
    )

    await ctx.mongo.database.samples.create_index([("created_at", DESCENDING)])

    await ctx.mongo.database.sequences.create_indexes(
        [
            IndexModel([("otu_id", ASCENDING)]),
            IndexModel([("name", ASCENDING)]),
            IndexModel([("reference.id", ASCENDING), ("remote.id", ASCENDING)]),
        ],
    )

    await ctx.mongo.database.users.create_indexes(
        [
            IndexModel([("b2c_oid", ASCENDING)], unique=True, sparse=True),
            IndexModel([("handle", ASCENDING)], unique=True, sparse=True),
        ],
    )


async def test_upgrade(ctx, snapshot):
    async with ctx.revision_context() as revision_ctx:
        await upgrade(revision_ctx)

    assert (
        await asyncio.gather(
            ctx.mongo.analyses.index_information(),
            ctx.mongo.groups.index_information(),
            ctx.mongo.history.index_information(),
            ctx.mongo.indexes.index_information(),
            ctx.mongo.keys.index_information(),
            ctx.mongo.otus.index_information(),
            ctx.mongo.samples.index_information(),
            ctx.mongo.sequences.index_information(),
            ctx.mongo.users.index_information(),
        )
        == snapshot
    )
